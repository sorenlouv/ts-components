import React, {Component} from 'react';
import _ from 'lodash';
import Bluebird from 'bluebird';
import { hashHistory } from 'react-router';
import githubService from '../services/github';
import Clipboard from 'clipboard';

// Modules
import PullRequestCompleter from './PullRequestCompleter.jsx';
import { AheadByButton, BehindByButton, CopyButton } from './ComponentButtons.jsx';
import SelectedPullRequest from './SelectedPullRequest.jsx';

function getRepoUrl (name, sha = '') {
	return 'https://github.com/Tradeshift/' + name + '/commits/' + sha;
}

const ENVIRONMENTS = ['testing', 'stable', 'production'];

export default class MainContainer extends Component {
	constructor (props) {
		super(props);
		this.state = {
			isLoading: true,
			pullRequest: {},
			puppetComponents: []
		};
	}

	onSelectPullRequest (pullRequest) {
		if (pullRequest.number !== this.state.pullRequest.number) {
			this.setState({
				pullRequest: pullRequest,
				puppetComponents: []
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
		new Clipboard('.btn-copy');
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
				return Bluebird.all(
					ENVIRONMENTS.map(env => githubService.getPuppetComponents(env, headSha))
				);
			})
			.then(components => {
				this.setState({
					puppetComponents: components,
					isLoading: false
				});
			})
			.catch(error => console.error('Could not get getPuppetComponents', error));
	}

	render () {
		const DiffExplanations = () => {
			const hasPR = !!this.props.pullRequestNumber;
			const aheadText = hasPR
				? 'Versions.yaml (pull request) is ahead of versions.yaml (Testing)'
				: 'Version.yaml has a revision which is not merged to master';

			const behindText = hasPR
				? 'Versions.yaml (pull request) is behind versions.yaml (Testing)'
				: 'Version.yaml is not updated with latest master';

			return (
				<div className='col-md-6 diff-explanation'>
					<div>
						<a className='diff-ahead'>Commits ahead</a><p>{aheadText}</p>
					</div>
					<div>
						<a className='diff-behind'>Commits behind</a><p>{behindText}</p>
					</div>
				</div>
			);
		};

		const Content = () => {
			if (this.state.isLoading) {
				return <div className='loading-spinner'><img src='spinner.gif' /></div>;
			}

			if (this.state.pullRequest.merged) {
				return <p>This PR was merged, so there is no diff to display</p>;
			}

			const componentNames = _.get(this.state.puppetComponents, 0, []).map(component => component.name);
			const columns = !this.props.pullRequestNumber ? ENVIRONMENTS : ['testing'];
			const tableHead = columns.map(environment => {
				return [<td><a href={`https://github.com/Tradeshift/tradeshift-puppet/blob/${environment}/hiera/versions.yaml`}>{environment}</a></td>];
			});

			const tableBody = componentNames.map(name => {
				return (
					<tr key={name}>
						<td><a href={getRepoUrl(name)}>{name}</a></td>
						{
							columns.map((environment, i) => {
								const reverseButton = !this.props.pullRequestNumber;
								const testingComponent = _.find(this.state.puppetComponents[0], {name: name});
								const component = _.find(this.state.puppetComponents[i], {name: name});
								const isIdentical = i !== 0 && _.isEqual(testingComponent, component);
								const isTesting = i === 0;

								return [<td className={isIdentical ? 'identical' : ''}>
									<AheadByButton component={component} reverse={reverseButton} />
									<BehindByButton component={component} reverse={reverseButton} />
									{isTesting ? <CopyButton component={component} reverse={reverseButton}/ > : null }
								</td>];
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
					<DiffExplanations />
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
