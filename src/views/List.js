const React = require('react');
const url = require('url');
const githubService = require('../services/github');
const Bluebird = require('bluebird');
const _ = require('lodash');
const Clipboard = require('clipboard');

function decorateWithDiffs(puppetVersions) {
	let promises = puppetVersions.map(repo => {
		return githubService.getDiff(repo.name, repo.version, 'master')
		.then(diff => {
			repo.diff = diff;
			return repo;
		})
		.catch(e => {
			console.error('Error getting diff', repo.name);
			return repo;
		});
	});

	return Bluebird.all(promises);
}

module.exports = React.createClass({
	getInitialState: function() {
		return {
			puppetVersions: [],
			query: ''
		};
	},

	componentDidMount: function() {
		new Clipboard('.btn');

		githubService.getAccessToken()
			.then(token => {
				githubService.setAccessToken(token);
				return githubService.getPuppetVersions();
			})
			.then(puppetVersions => decorateWithDiffs(puppetVersions))
			.then(puppetVersions => this.setState({puppetVersions}))
			.catch(error => console.log(error));
	},

	onQueryChange: function(event) {
		this.setState({ query: event.target.value });
	},

	render: function() {
		if (_.isEmpty(this.state.puppetVersions)) {
			return <div>Loading...</div>;
		}

		let query = this.state.query
		function byQuery(repo) {
			return repo.name.toLowerCase().includes(query.toLowerCase());
		}

		function isUpdated(repo) {
			return _.get(repo, 'diff.ahead_by') === 0 || _.isEmpty(_.get(repo, 'diff.files'));
		}

		let outdatedList = this.state.puppetVersions
			.filter(_.negate(isUpdated))
			.filter(byQuery)
			.map((repo, i) => {
				return <li key={i}>
					{repo.name} (<a href={repo.diff.html_url}>{repo.diff.ahead_by} behind</a>)
					<button className="btn" data-clipboard-text={githubService.getShortlog(repo.diff.commits)}>Copy</button>
				</li>;
			});

		let updatedList = this.state.puppetVersions
			.filter(isUpdated)
			.filter(byQuery)
			.map((repo, i) => {
				return <li key={i}>{repo.name}</li>;
			});

		return <div>
			<input type="text" placeholder="Search" onChange={this.onQueryChange} value={this.state.query}/>

			<h3>Outdated:</h3>
			<ul>{outdatedList}</ul>

			<h3>Up-to-date:</h3>
			<ul>{updatedList}</ul>
		</div>;
	}
});
