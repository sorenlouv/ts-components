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

	return <div>
		<span className='image'><img src={pullRequest.user.avatar_url + '&s=30'} /></span>
		<span className='number'>
			<a href={'https://github.com/Tradeshift/tradeshift-puppet/pull/' + pullRequest.number}>{pullRequest.number}</a>
		</span>
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
			pullRequestNumber: props.params.pullRequestNumber,
			pullRequest: {},
			isAuthenticated: false
		};
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
		if (this.state.isAuthenticated && prevState.pullRequestNumber !== this.state.pullRequestNumber) {
			hashHistory.push(_.toString(this.state.pullRequestNumber));
			this.getPuppetComponents();
		}
	}

	onSelectPullRequest (pullRequest) {
		this.setState({
			pullRequestNumber: pullRequest.number,
			pullRequest: pullRequest,
			puppetComponents: []
		});
	}

	onClickResetPullRequest () {
		this.setState({
			pullRequest: {},
			pullRequestNumber: null
		});
	}

	getPuppetComponents () {
		this.setState({
			isLoading: true
		});

		let promise = Bluebird.resolve();
		if (this.state.pullRequestNumber) {
			promise = githubService.getPullRequest(this.state.pullRequestNumber)
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
				const headSha = _.get(pullRequest, 'head.sha');
				const baseSha = _.get(pullRequest, 'base.sha');
				return githubService.getPuppetComponents({headSha, baseSha});
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

		function getBehindByUrl (component) {
			return 'https://github.com/Tradeshift/' + component.name + '/compare/' + component.to + '...' + component.from;
		}

		function getAheadByUrl (component) {
			return 'https://github.com/Tradeshift/' + component.name + '/compare/' + component.from + '...' + component.to;
		}

		const componentsComparedToBase = this.state.puppetComponents
			.map(component => {
				const newComponent = _.find(component.diffs, {type: 'base'}) || {};
				newComponent.name = component.name;
				return newComponent;
			});

		const componentsComparedToMaster = this.state.puppetComponents
			.map(component => {
				const newComponent = _.find(component.diffs, {type: 'master'}) || {};
				newComponent.name = component.name;
				return newComponent;
			});

		const nonPrComponents = this.state.puppetComponents
			.map(component => {
				const newComponent = _.find(component.diffs, {type: 'nonPr'}) || {};
				newComponent.name = component.name;
				return newComponent;
			});

		function getRepoUrl (name, sha) {
			return 'https://github.com/Tradeshift/' + name + '/commits/' + sha;
		}

		const ComponentsList = ({title, components}) => {
			const rows = components
			.filter(component => {
				return _.get(component.diff, 'behind_by') > 0 || _.get(component.diff, 'ahead_by');
			})
			.map((component, i) => {
				return <tr key={i}>
					<td><a href={getRepoUrl(component.name, component.from)}>{component.name}</a></td>
					<td>
						{ component.diff.ahead_by > 0 ? <a className='diff-ahead' href={getAheadByUrl(component)}>{component.diff.ahead_by} ahead</a> : null }
						{ component.diff.behind_by > 0 ? <a className='diff-behind' href={getBehindByUrl(component)}>{component.diff.behind_by} behind</a> : null }
					</td>
					<td>
						<button
							type='button'
							className='btn-copy btn btn-primary btn-sm'
							data-clipboard-text={githubService.getShortlog(component.diff.commits)}>
							Copy
						</button>
					</td>
				</tr>;
			});

			if (_.isEmpty(rows)) {
				return null;
			}

			return (
				<div className={classNames('col-md-6', this.state.isLoading || _.isEmpty(components) ? 'hidden' : '')}>
					<h3>{title}:</h3>
					<table className='changed-components-list'>
						<tbody>{rows}</tbody>
					</table>
				</div>
			);
		};

		const InfoText = ({isLoading, components}) => {
			const changedComponentCount = components.filter(component => _.size(component.diffs) > 0).length;
			if (changedComponentCount > 0) {
				return null;
			}

			return (
				<div className='col-md-6'>
					{
						this.state.isLoading
							? <div className='loading-spinner'><img src='spinner.gif' /></div>
							: <p>No components were changed for this PR</p>
					}
				</div>
			);
		};

		return (
			<div>
				<div className='row'>
					<div className='col-md-12'>
						<PullRequestCompleter
							onSelectPullRequest={this.onSelectPullRequest.bind(this)} />

						<div className='pull-request-info'>
							{
								_.isEmpty(this.state.pullRequest)
									? 'The table below shows the version of each component in version.yaml, compared to the master branch in the component repository.'
									: <SelectedPullRequest
										pullRequest={this.state.pullRequest}
										onClickResetPullRequest={this.onClickResetPullRequest.bind(this)} />
							}
						</div>
					</div>

					<InfoText isLoading={this.state.isLoading} components={this.state.puppetComponents} />

					<ComponentsList title='Compared with "testing" version.yaml' components={componentsComparedToMaster} />
					<ComponentsList title='Compared with base version.yaml' components={componentsComparedToBase} />
					<ComponentsList title='Current components' components={nonPrComponents} />
				</div>
			</div>
		);
	}
}
