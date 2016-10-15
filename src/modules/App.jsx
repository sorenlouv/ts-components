import classNames from 'classnames';
import React, {Component} from 'react';
import { hashHistory } from 'react-router';
import githubService from '../services/github';
import PullRequestCompleter from './PullRequestCompleter.jsx';
import Clipboard from 'clipboard';
import Bluebird from 'bluebird';
import _ from 'lodash';

const SelectedPullRequest = ({pullRequest, onClickResetPullRequest}) => {
	if (_.isEmpty(pullRequest)) {
		return null;
	}

	return <div className='pull-request-info'>
		<span className='image'><img src={pullRequest.user.avatar_url + '&s=30'} /></span>
		<span className='number'>{pullRequest.number}</span>
		<span className='title'>{pullRequest.title}</span>
		<a onClick={onClickResetPullRequest}>
			<span className='glyphicon glyphicon glyphicon-remove-circle' />
		</a>
	</div>;
};

export default class App extends Component {
	constructor (props) {
		super(props);
		this.state = {
			puppetComponents: [],
			isLoading: true,
			query: props.params.pullRequestNumber || '',
			pullRequest: {},
			isAuthenticated: false
		};
		this.onSelectPullRequest = this.onSelectPullRequest.bind(this);
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
		const currentPullRequestNumber = _.get(this.state.pullRequest, 'number');
		const prevPullRequestNumber = _.get(prevState.pullRequest, 'number');
		if (this.state.isAuthenticated && prevPullRequestNumber !== currentPullRequestNumber) {
			hashHistory.push(_.toString(currentPullRequestNumber));
			this.getPuppetComponents();
		}
	}

	onSelectPullRequest (event, { suggestion }) {
		this.setState({
			query: '',
			pullRequest: suggestion,
			puppetComponents: [],
			isLoading: true
		});
	}

	onClickResetPullRequest () {
		this.setState({
			pullRequest: {},
			query: ''
		});
	}

	onChangeQuery (event, { newValue }) {
		this.setState({
			query: newValue
		});
	}

	getPuppetComponents () {
		let promise = Bluebird.resolve();
		if (this.state.query) {
			promise = githubService.getPullRequest(this.state.query)
				.then(pullRequest => {
					this.setState({
						pullRequest: pullRequest
					});
					return pullRequest;
				})
				.catch(err => {
					switch (_.get(err, 'response.status')) {
						case 404:
							console.warn('Pull request does not exist');
							break;
						default:
							console.error('Could not get pull request', err);
					}
					throw err;
				});
		}

		promise
			.then(pullRequest => {
				const ref = _.get(pullRequest, 'head.sha');
				return githubService.getPuppetComponents(ref);
			})
			.then(puppetComponents => {
				this.setState({
					puppetComponents: puppetComponents,
					isLoading: false
				});
			})
			.catch(error => console.error('Could not get getPuppetComponents', error));
	}

	onClickLogin () {
		githubService.authenticate();
	}

	render () {
		if (!this.state.isAuthenticated) {
			return (
				<button type='button' className='github-login btn btn-default btn-lg' onClick={this.onClickLogin}>
					<img src='github-icon.png' width='30' /> Sign in with Github
				</button>
			);
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
				<div className='row'>
					<div className='col-md-12'>
						<PullRequestCompleter
							query={this.state.query}
							onChangeQuery={this.onChangeQuery.bind(this)}
							onSelect={this.onSelectPullRequest} />

						<SelectedPullRequest
							pullRequest={this.state.pullRequest}
							onClickResetPullRequest={this.onClickResetPullRequest.bind(this)} />
					</div>

					<div className={classNames('col-md-6', this.state.isLoading ? 'hidden' : '')}>
						<h3>Changes:</h3>
						<table className='changed-components-list'>
							<tbody>{changedComponents}</tbody>
						</table>
					</div>

					<div className={classNames('col-md-6', this.state.isLoading ? 'hidden' : '')}>
						<h3>Unchanged:</h3>
						<ul>{unChangedComponents}</ul>
					</div>
				</div>
			</div>
		);
	}
}
