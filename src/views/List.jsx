import React, {Component} from 'react';
import githubService from '../services/github';
import Clipboard from 'clipboard';
import _ from 'lodash';

export default class App extends Component {
	constructor (props) {
		super(props);
		this.state = {
			puppetComponents: [],
			query: '',
			pullRequest: {},
			isAuthenticated: false
		};

		this.onQueryChange = this.onQueryChange.bind(this);
	}

	componentDidMount () {
		new Clipboard('.btn-copy'); // eslint-disable-line no-new

		githubService.init();
		githubService.onAuthStateChanged(user => {
			githubService.isAccessTokenValid().then(isValid => {
				if (isValid) {
					this.setState({
						isAuthenticated: true
					});

					this.getPuppetComponents();
				}
			});
		});
	}

	componentDidUpdate (prevProps, prevState) {
		if (this.state.isAuthenticated && prevState.pullRequest !== this.state.pullRequest) {
			this.getPuppetComponents();
		}
	}

	getPuppetComponents () {
		const ref = _.get(this.state.pullRequest, 'head.sha');
		return githubService.getPuppetComponents(ref)
			.then(puppetComponents => this.setState({puppetComponents}))
			.catch(error => console.error('Could not get getPuppetComponents', error));
	}

	onClickLogin () {
		githubService.authenticate();
	}

	onQueryChange (event) {
		const pullRequestQuery = event.target.value;
		if (!pullRequestQuery) {
			this.setState({
				query: pullRequestQuery,
				pullRequest: {}
			});
			return;
		}

		this.setState({ query: pullRequestQuery });
		githubService.getPullRequest(pullRequestQuery)
			.then(pullRequest => {
				this.setState({ pullRequest: pullRequest });
			})
			.catch(err => {
				switch (_.get(err, 'response.status')) {
					case 404:
						console.warn('Pull request does not exist');
						break;
					default:
						console.error('Could not get pull request', err);
				}
			});
	}

	render () {
		if (!this.state.isAuthenticated) {
			return (
				<button type='button' className='github-login btn btn-default btn-lg' onClick={this.onClickLogin}>
					<img src='github-icon.png' width='30' /> Sign in with Github
				</button>
			);
		}

		if (_.isEmpty(this.state.puppetComponents)) {
			return <div>Loading...</div>;
		}

		function isChanged (component) {
			return _.get(component, 'diff.ahead_by') > 0 || _.get(component, 'diff.behind_by') > 0;
		}

		function getBehindByUrl (component) {
			return 'https://github.com/Tradeshift/' + component.name + '/compare/' + component.shaTo + '...' + component.shaFrom;
		}

		function getAheadByUrl (component) {
			return 'https://github.com/Tradeshift/' + component.name + '/compare/' + component.shaFrom + '...' + component.shaTo;
		}

		const changedComponents = this.state.puppetComponents
			.filter(isChanged)
			.map((component, i) => {
				return <tr key={i}>
					<td>{component.name}</td>
					<td>
						{ component.diff.ahead_by > 0 ? <a className='diff-ahead' href={getAheadByUrl(component)}>{component.diff.ahead_by} ahead</a> : null }
						{ component.diff.behind_by > 0 ? <a className='diff-behind' href={getBehindByUrl(component)}>{component.diff.behind_by} behind</a> : null }
					</td>
					<td>
						{ component.diff.ahead_by > 0 ? <button type='button' className='btn-copy btn btn-primary btn-sm' data-clipboard-text={githubService.getShortlog(component.diff.commits)}>Copy</button> : null }
					</td>
				</tr>;
			});

		const unChangedComponents = this.state.puppetComponents
			.filter(_.negate(isChanged))
			.map((component, i) => {
				return <li key={i}>{component.name} {component.error ? <span className='glyphicon glyphicon-exclamation-sign' title={component.error.message} /> : null}</li>;
			});

		return (
			<div>
				<div>
					<input className='search-input' type='text' placeholder='Pull request number, eg. 1323' onChange={this.onQueryChange} value={this.state.query} />
					<span className='pull-request-info'>{ !_.isEmpty(this.state.pullRequest) ? this.state.pullRequest.title + ' by ' + this.state.pullRequest.user.login : null }</span>
				</div>

				<div className='row'>
					<div className='col-md-6'>
						<h3>Changes:</h3>
						<table className='changed-components-list'>
							<tbody>{changedComponents}</tbody>
						</table>
					</div>
					<div className='col-md-6'>
						<h3>Unchanged:</h3>
						<ul>{unChangedComponents}</ul>
					</div>
				</div>
			</div>
		);
	}
}
