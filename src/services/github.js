const gitDiffParser = require('./gitDiffParser');
const axios = require('axios');
const firebase = require('firebase');
const config = require('../config.json');
const repos = require('../repos.json');
const Cookies = require('js-cookie');
const Bluebird = require('bluebird');
const yaml = require('js-yaml');
const _ = require('lodash');

let githubService = {};
const COOKIE_NAME = 'github_access_token';

githubService.req = function (url, options) {
	const config = _.defaults(options, {
		url: url,
		params: {
			access_token: githubService.getAccessToken()
		}
	});
	return axios(config).then(res => {
		return config.raw ? res : res.data;
	});
};

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
	var provider = new firebase.auth.GithubAuthProvider();
	provider.addScope('repo');
	return firebase.auth().signInWithRedirect(provider);
};

githubService.isAccessTokenValid = function () {
	return githubService.req('https://api.github.com/user')
		.then(() => true)
		.catch(() => false);
};

githubService.getPullRequest = function (id) {
	return githubService.req('https://api.github.com/repos/Tradeshift/tradeshift-puppet/pulls/' + id).then(rawDiff => {
		let diff = gitDiffParser(rawDiff);
		let lines = diff.commits[0].files[0].lines.filter(line => line.type === 'deleted' || line.type === 'added');
		return lines;
	});
};

githubService.getFile = function (path) {
	return githubService.req('https://api.github.com/repos/Tradeshift/tradeshift-puppet/contents/' + path).then(file => {
		return new Buffer(file.content, 'base64').toString('ascii');
	});
};

githubService.getRepoName = function(puppetKey) {
	const puppetName = puppetKey.split('::')[2];
	return repos[puppetName];
};

githubService.getSha = function(repoName, lineValue) {
	const isTag = /^\d+(\.\d+)+$/.test(lineValue);
	if (!isTag) {
		return Bluebird.resolve(lineValue.includes('SNAPSHOT') ? _.last(lineValue.split('-')) : lineValue);
	}

	return githubService.getShaByTag(repoName, 'v' + lineValue);
};

githubService.getShaByTag = function(repoName, tag) {
	return githubService.req('https://api.github.com/repos/Tradeshift/' + repoName + '/git/refs/tags/' + tag)
		.then(res => res.object.sha)
		.catch(err => {
			switch(_.get(err, 'response.status')) {
				case 404:
					throw new Error(`The tag "${tag}" for ${repoName} does not exist`);
				default:
					throw err;
			}
		})
};

githubService.getPuppetVersions = function () {
	let path = 'hiera/versions.yaml';
	return githubService.getFile(path)
		.then(fileYaml => {
			var promises = _.map(yaml.safeLoad(fileYaml), (value, key) => {
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
							}
						})
						.catch(err => {
							return {
								name: repoName,
								error: err
							}
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
	let promises = puppetVersions.map(repo => {
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
	let shortLog = _.chain(commits)
		.groupBy('author.login')
		.map(groupCommits => {
			return {
				author: _.get(_.first(groupCommits), 'commit.author.name'),
				commits: groupCommits
			};
		})
		.sortBy('author')
		.reduce((memo, group) => {
			let countStr = ' (' + group.commits.length + '):';
			let commitsStr = group.commits.map(commit => _.repeat(' ', 6) + _.first(commit.commit.message.split('\n'))).join('\n');
			memo += group.author + countStr + '\n' + commitsStr + '\n\n';
			return memo;
		}, '')
		.value();
	return shortLog;
};

module.exports = githubService;
