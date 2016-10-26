import axios from 'axios';
import firebase from 'firebase';
import config from '../config.json';
import repos from '../repos.json';
import * as Cookies from 'js-cookie';
import Bluebird from 'bluebird';
import * as yaml from 'js-yaml';
import _ from 'lodash';

const githubService = {};
const COOKIE_NAME = 'github_access_token';

githubService.req = _.memoize((url, options) => {
	const opts = _.defaultsDeep({}, options, {
		url: url,
		params: {
			access_token: githubService.getAccessToken()
		}
	});
	return axios(opts).then(res => {
		return opts.raw ? res : res.data;
	});
}, (url, options = {}) => JSON.stringify([url, options]));

githubService.setAccessToken = function (accessToken) {
	Cookies.set(COOKIE_NAME, accessToken);
};

githubService.getAccessToken = function () {
	return Cookies.get(COOKIE_NAME);
};

githubService.init = function () {
	firebase.initializeApp(config);
	firebase.auth().getRedirectResult().then(function (res) {
		const accessToken = _.get(res, 'credential.accessToken');
		if (accessToken) {
			githubService.setAccessToken(accessToken);
		}
	});
};

githubService.onAuthStateChanged = function (cb) {
	firebase.auth().onAuthStateChanged(cb);
};

githubService.authenticate = function () {
	const provider = new firebase.auth.GithubAuthProvider();
	provider.addScope('repo');
	return firebase.auth().signInWithRedirect(provider);
};

githubService.isAccessTokenValid = function () {
	return githubService.req('https://api.github.com/repos/Tradeshift/tradeshift-puppet/contents/hiera/versions.yaml')
		.then(() => true)
		.catch(() => false);
};

githubService.getRepoName = function (puppetKey) {
	const puppetName = puppetKey.split('::')[2];
	return repos[puppetName];
};

githubService.getSha = function (repoName, lineValue) {
	const isTag = /^\d+(\.\d+)+$/.test(lineValue);
	if (!isTag) {
		const sha = _.first(lineValue.match(/\b[0-9a-f]{5,40}\b/));
		return Bluebird.resolve(sha);
	}

	return githubService.getShaByTag(repoName, 'v' + lineValue);
};

githubService.getShaByTag = function (repoName, tag) {
	return githubService.req('https://api.github.com/repos/Tradeshift/' + repoName + '/git/refs/tags/' + tag)
		.then(res => githubService.req('https://api.github.com/repos/Tradeshift/Backend-Service/git/tags/' + res.object.sha))
		.then(res => res.object.sha)
		.catch(err => {
			switch (_.get(err, 'response.status')) {
				case 404:
					throw new Error(`The tag "${tag}" for ${repoName} does not exist`);
				default:
					throw err;
			}
		});
};

githubService.getPullRequest = function (number) {
	return githubService.req('https://api.github.com/repos/Tradeshift/tradeshift-puppet/pulls/' + number);
};

githubService.searchPullRequests = function (q) {
	return githubService.req('https://api.github.com/search/issues?q=type:pr repo:Tradeshift/tradeshift-puppet ' + q);
};

githubService.getVersionLines = function (ref) {
	const options = ref ? { params: { ref: ref } } : {};
	return githubService.req('https://api.github.com/repos/Tradeshift/tradeshift-puppet/contents/hiera/versions.yaml', options)
		.then(file => {
			const fileString = new Buffer(file.content, 'base64').toString('ascii');
			return _.map(yaml.safeLoad(fileString), (value, key) => {
				return {key, value};
			});
		});
};

githubService.getComponents = function (ref) {
	return githubService.getVersionLines(ref).then(versionLines => {
		const promises = versionLines.map(line => {
			line.name = githubService.getRepoName(line.key);
			if (!line.name) {
				// console.warn('Repo was not found for', line.key);
				return line;
			}

			return githubService.getSha(line.name, line.value)
				.then(sha => {
					line.sha = sha;
					return line;
				})
				.catch(err => {
					// console.warn(`Could not get sha for ${line.name}`, err);
					line.error = err;
					return line;
				});
		});

		return Bluebird.all(promises);
	});
};

githubService.getPuppetComponents = function (baseRef, headSha) {
	const componentPromises = [ githubService.getComponents(baseRef) ];

	if (headSha) {
		componentPromises.push(githubService.getComponents(headSha));
	}

	return Bluebird.all(componentPromises)
		.spread((currentComponents, headComponents) => {
			const promises = currentComponents
				.filter(component => component.name)
				.map(component => {
					const headComponent = _.find(headComponents, {key: component.key});
					let from, to;
					if (!headComponent) {
						from = component.sha;
						to = 'master';
					} else if (_.get(headComponent, 'sha') && component.sha !== headComponent.sha) {
						from = component.sha;
						to = headComponent.sha;
					}

					return {
						name: component.name,
						error: component.error,
						from: from,
						to: to
					};
				});

			return Bluebird.all(promises).then(components => {
				return _.sortBy(components, 'name');
			});
		})
		.then(githubService.decorateCompenents);
};

githubService.getDiff = function (repoName, from, to) {
	return githubService.req('https://api.github.com/repos/Tradeshift/' + repoName + '/compare/' + from + '...' + to);
};

githubService.decorateComponentWithDiffs = function (component) {
	if (!component.name || !component.from || component.name === component.from) {
		return Bluebird.resolve(component);
	}

	return githubService.getDiff(component.name, component.from, component.to)
		.then(diff => {
			return _.pick(diff, ['status', 'ahead_by', 'behind_by', 'commits']);
		})
		.then(diff => {
			component.diff = diff;
			return component;
		})
		.catch(err => {
			console.error('Could not get diff', component.name, err);
			return component;
		});
};

githubService.decorateCompenents = function (components) {
	const promises = components.map(githubService.decorateComponentWithDiffs);
	return Bluebird.all(promises);
};

githubService.getShortlog = function (commits) {
	const shortLog = _.chain(commits)
		.groupBy('author.login')
		.map(groupCommits => {
			return {
				author: _.get(_.first(groupCommits), 'commit.author.name'),
				commits: groupCommits
			};
		})
		.sortBy('author')
		.reduce((memo, group) => {
			const countStr = ' (' + group.commits.length + '):';
			const commitsStr = group.commits.map(commit => _.repeat(' ', 6) + _.first(commit.commit.message.split('\n'))).join('\n');
			memo += group.author + countStr + '\n' + commitsStr + '\n\n';
			return memo;
		}, '')
		.value();
	return shortLog;
};

module.exports = githubService;
