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

githubService.getPuppetVersions = function () {
	let path = 'hiera/versions.yaml';
	return githubService.getFile(path).then(fileYaml => {
		let fileJson = yaml.safeLoad(fileYaml);
		let versions = _.reduce(fileJson, function (memo, sha, key) {
			let puppetName = key.split('::')[2];
			let repoName = repos[puppetName];
			if (repoName) {
				memo.push({
					name: repoName,
					version: sha.includes('SNAPSHOT') ? _.last(sha.split('-')) : sha
				});
			} else {
				console.warn('Repo was not found for', puppetName);
			}
			return memo;
		}, []);
		return _.sortBy(versions, 'name');
	});
};

githubService.getLatestVersion = function (repoName) {
	return githubService.req('https://api.github.com/repos/Tradeshift/' + repoName + '/commits').then(commits => {
		return _.first(commits).sha;
	});
};

githubService.getLatestVersions = function () {
	return Bluebird.all(_.values(repos).map(repoName => {
		return githubService.getLatestVersion(repoName).then(sha => ({
			name: repoName,
			latest: sha
		}));
	}));
};

githubService.getDiff = function (repoName, from, to) {
	return githubService.req('https://api.github.com/repos/Tradeshift/' + repoName + '/compare/' + from + '...' + to);
};

githubService.getShortlog = function (commits) {
	let shortLog = _.chain(commits).groupBy('author.login').map(groupCommits => {
		return {
			author: _.get(_.first(groupCommits), 'commit.author.name'),
			commits: groupCommits
		};
	}).sortBy('author').reduce((memo, group) => {
		let countStr = ' (' + group.commits.length + '):';
		let commitsStr = group.commits.map(commit => '\t' + _.first(commit.commit.message.split('\n'))).join('\n');
		memo += group.author + countStr + '\n' + commitsStr + '\n\n';
		return memo;
	}, '').value();
	return shortLog;
};

module.exports = githubService;
