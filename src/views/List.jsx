	import React, {Component} from 'react';
	import githubService from '../services/github';
	import Bluebird from 'bluebird';
	import _ from 'lodash';
	import Clipboard from 'clipboard';

	export default class App extends Component {
		constructor (props) {
			super(props);
			this.state = {
				puppetVersions: [],
				query: '',
				isAuthenticated: false
			};

			this.onQueryChange = this.onQueryChange.bind(this);
		}

		componentDidMount () {
			new Clipboard('.btn-copy');

			githubService.init();
			githubService.onAuthStateChanged(user => {
				githubService.isAccessTokenValid().then(isValid => {
					if (isValid) {
						this.setState({
							isAuthenticated: true
						});
						this.getPuppetVersions();
					}
				});
			});
		}

		getPuppetVersions () {
			return githubService.getPuppetVersions()
				.then(puppetVersions => this.setState({puppetVersions}))
				.catch(error => console.log(error));
		}

		onClickLogin () {
			githubService.authenticate();
		}

		onQueryChange (event) {
			this.setState({ query: event.target.value });
		}

		render () {
			if (!this.state.isAuthenticated) {
				return (
					<button type='button' className='github-login btn btn-default btn-lg' onClick={this.onClickLogin}>
						<img src='github-icon.png' width='30' /> Sign in with Github
					</button>
				);
			}

			if (_.isEmpty(this.state.puppetVersions)) {
				return <div>Loading...</div>;
			}

			let query = this.state.query;
			function byQuery (repo) {
				return repo.name.toLowerCase().includes(query.toLowerCase());
			}

			function isUpdated (repo) {
				return _.get(repo, 'diff.ahead_by') === 0 || _.isEmpty(_.get(repo, 'diff.files'));
			}

			let outdatedList = this.state.puppetVersions
				.filter(_.negate(isUpdated))
				.filter(byQuery)
				.map((repo, i) => {
					return <div key={i}>
						<button type='button' className='btn-copy btn btn-primary btn-sm' data-clipboard-text={githubService.getShortlog(repo.diff.commits)}>Copy</button>
						{repo.name} <a href={repo.diff.html_url}><span className='badge' title={repo.diff.ahead_by + ' commits behind'}>{repo.diff.ahead_by}</span></a>
					</div>;
				});

			let updatedList = this.state.puppetVersions
				.filter(isUpdated)
				.filter(byQuery)
				.map((repo, i) => {
					return <li key={i}>{repo.name} {repo.error ? <span className='glyphicon glyphicon-exclamation-sign' title={repo.error.message}></span> : null}</li>;
				});

			return (
				<div>
					<input className='search-input' type='text' placeholder='Search' onChange={this.onQueryChange} value={this.state.query} />

					<div className='row'>
						<div className='col-md-6'>
							<h3>Outdated:</h3>
							<div>{outdatedList}</div>
						</div>
						<div className='col-md-6'>
							<h3>Up-to-date:</h3>
							<ul>{updatedList}</ul>
						</div>
					</div>
				</div>
			);
		}
	}
