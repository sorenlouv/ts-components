import React, {Component} from 'react';
import _ from 'lodash';
import Bluebird from 'bluebird';
import { hashHistory } from 'react-router';
import githubService from '../services/github';

// Modules
import PullRequestCompleter from './PullRequestCompleter.jsx';
import { AheadByButton, BehindByButton } from './ComponentButtons.jsx';
import SelectedPullRequest from './SelectedPullRequest.jsx';

function getRepoUrl (name, sha = '') {
	return 'https://github.com/Tradeshift/' + name + '/commits/' + sha;
}

export default class MainContainer extends Component {
	constructor (props) {
		super(props);
		this.state = {
			isLoading: true,
			pullRequest: {},
			puppetComponents: {}
		};
	}

	onSelectPullRequest (pullRequest) {
		if (pullRequest.number !== this.state.pullRequest.number) {
			this.setState({
				pullRequest: pullRequest,
				puppetComponents: {}
			});
			hashHistory.push(_.toString(pullRequest.number));
		}
	}

	onClickResetPullRequest () {
		this.setState({
			pullRequest: {}
		});
		hashHistory.push('');
	}

	componentDidMount () {
		this.getPuppetComponents();
	}

	componentDidUpdate (prevProps, prevState) {
		const didPrNumberChange = prevProps.pullRequestNumber !== this.props.pullRequestNumber;
		if (didPrNumberChange) {
			this.getPuppetComponents();
		}
	}

	getPuppetComponents () {
		this.setState({
			isLoading: true
		});

		let promise = Bluebird.resolve();
		if (this.props.pullRequestNumber) {
			promise = githubService.getPullRequest(this.props.pullRequestNumber).then(pullRequest => {
				this.setState({ pullRequest });
				return _.get(pullRequest, 'head.sha');
			});
		}

		promise
			.then(headSha => {
				return Bluebird.all([
					githubService.getPuppetComponents('testing', headSha),
					githubService.getPuppetComponents('production', headSha),
					githubService.getPuppetComponents('sandbox', headSha),
					githubService.getPuppetComponents('smoketest', headSha),
					githubService.getPuppetComponents('staging', headSha)
				]);
			})
			.spread((testing, production, sandbox, smoketest, staging) => {
				this.setState({
					puppetComponents: {
						testing,
						smoketest,
						sandbox,
						staging,
						production
					},
					isLoading: false
				});
			})
			.catch(error => console.error('Could not get getPuppetComponents', error));
	}

	render () {
		const Content = () => {
			if (this.state.isLoading) {
				return <div className='loading-spinner'><img src='spinner.gif' /></div>;
			}

			if (this.state.pullRequest.merged) {
				return <p>This PR was merged, so there is no diff to display</p>;
			}

			const environments = Object.keys(this.state.puppetComponents);
			const componentNames = _.get(this.state.puppetComponents, 'testing', []).map(component => component.name);

			const tableHead = environments.map(environment => {
				return [<td>{environment}</td>];
			});

			const tableBody = componentNames.map(name => {
				return (
					<tr key={name}>
						<td><a href={getRepoUrl(name)}>{name}</a></td>
						{
							environments.map(environment => {
								const component = _.find(this.state.puppetComponents[environment], {name: name});
								return [<td><AheadByButton component={component} /> <BehindByButton component={component} /></td>];
							})
						}
					</tr>
				);
			});

			return (
				<table className='overview'>
					<thead><tr><td />{tableHead}</tr></thead>
					<tbody>{tableBody}</tbody>
				</table>
			);
		};

		return (
			<div>
				<div className='row'>
					<div className='col-md-6'>
						<PullRequestCompleter onSelectPullRequest={this.onSelectPullRequest.bind(this)} />
						<div className='selected-pull-request-container'>
							{
								_.isEmpty(this.state.pullRequest)
									? 'The table below shows the version of each component in version.yaml, compared to the master branch in the component repository.'
									: <SelectedPullRequest
										pullRequest={this.state.pullRequest}
										onClickResetPullRequest={this.onClickResetPullRequest.bind(this)} />
							}
						</div>
					</div>
				</div>
				<div className='row'>
					<div className='col-md-12'>
						<Content />
					</div>
				</div>
			</div>
		);
	}
};
