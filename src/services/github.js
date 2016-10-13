// const parseDiff = require('parse-diff');
const axios = require('axios');
const firebase = require('firebase');
const config = require('../config.json');
const repos = require('../repos.json');
const Cookies = require('js-cookie');
const Bluebird = require('bluebird');
const yaml = require('js-yaml');
const _ = require('lodash');

const githubService = {};
const COOKIE_NAME = 'github_access_token';

githubService.req = _.memoize((url, options) => {
	const opts = _.defaultsDeep(options, {
		url: url,
		params: {
			access_token: githubService.getAccessToken()
		}
	});
	return axios(opts).then(res => {
		return opts.raw ? res : res.data;
	});
}, (url, options) => JSON.stringify([url, options]));

window.sqren = githubService.req;

githubService.setAccessToken = function (accessToken) {
	Cookies.set(COOKIE_NAME, accessToken, {
		expires: 1
	});
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
	return githubService.req('https://api.github.com/user')
		.then(() => true)
		.catch(() => false);
};

// githubService.getPullRequest = function (id) {
// 	return githubService.req('https://api.github.com/repos/Tradeshift/tradeshift-puppet/pulls/' + id).then(rawDiff => {
// 		return _.chain(parseDiff(rawDiff))
// 			.filter(file => {
// 				return file.to === 'hiera/versions.yaml';
// 			})
// 			.first()
// 			.get('chunks')
// 			.map(chunk => {
// 				return chunk.changes
// 					.filter(change => change.type === 'del' || change.type === 'add')
// 					.map(change => change.content);
// 			});
// 	});
// };

githubService.getRepoName = function (puppetKey) {
	const puppetName = puppetKey.split('::')[2];
	return repos[puppetName];
};

githubService.getSha = function (repoName, lineValue) {
	const isTag = /^\d+(\.\d+)+$/.test(lineValue);
	if (!isTag) {
		return Bluebird.resolve(lineValue.includes('SNAPSHOT') ? _.last(lineValue.split('-')) : lineValue);
	}

	return githubService.getShaByTag(repoName, 'v' + lineValue);
};

githubService.getShaByTag = function (repoName, tag) {
	return githubService.req('https://api.github.com/repos/Tradeshift/' + repoName + '/git/refs/tags/' + tag)
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

githubService.getPuppetVersions = function (ref) {
	const options = {};
	if (ref) {
		_.set(options, 'params.ref', ref);
	}

	return githubService.req('https://api.github.com/repos/Tradeshift/tradeshift-puppet/contents/hiera/versions.yaml', options)
		.then(file => {
			return new Buffer(file.content, 'base64').toString('ascii');
		})
		.then(fileYaml => {
			const promises = _.map(yaml.safeLoad(fileYaml), (value, key) => {
				return {key, value};
			})
				.filter(line => {
					const repoName = githubService.getRepoName(line.key);
					if (!repoName) {
						console.warn('Repo was not found for', line.key);
						return false;
					}
					return true;
				})
				.map(line => {
					const repoName = githubService.getRepoName(line.key);
					return githubService.getSha(repoName, line.value)
						.then(sha => {
							return {
								name: repoName,
								sha: sha
							};
						})
						.catch(err => {
							return {
								name: repoName,
								error: err
							};
						});
				});

			return Bluebird.all(promises).then(versions => {
				return _.sortBy(versions, 'name');
			});
		})
		.then(githubService.decorateWithDiffs);
};

githubService.getDiff = function (repoName, from, to) {
	return githubService.req('https://api.github.com/repos/Tradeshift/' + repoName + '/compare/' + from + '...' + to);
};

githubService.decorateWithDiffs = function (puppetVersions) {
	const promises = puppetVersions.map(repo => {
		if (!repo.sha) {
			return Bluebird.resolve(repo);
		}

		return githubService.getDiff(repo.name, repo.sha, 'master')
			.then(diff => {
				repo.diff = diff;
				return repo;
			})
			.catch(e => {
				console.error('Error getting diff', repo.name, e);
				return repo;
			});
	});

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
