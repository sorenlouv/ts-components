import React from 'react';
import _ from 'lodash';
import githubService from '../services/github';

function getBehindByUrl (component) {
	return 'https://github.com/Tradeshift/' + component.name + '/compare/' + component.to + '...' + component.from;
}

function getAheadByUrl (component) {
	return 'https://github.com/Tradeshift/' + component.name + '/compare/' + component.from + '...' + component.to;
}

export function AheadByButton ({component}) {
	// Exclude diff if it only contains merge commits
	const hasNonMergeCommits = _.get(component.diff, 'commits', [])
		.some(commit => !commit.commit.message.match(/Merge pull request #\d+ from Tradeshift/));

	if (!_.get(component.diff, 'ahead_by') > 0 || !hasNonMergeCommits) {
		return null;
	}

	return <a className='diff-ahead' href={getAheadByUrl(component)}>{component.diff.ahead_by} ahead</a>;
}

export const BehindByButton = ({component}) => {
	if (!_.get(component.diff, 'behind_by') > 0) {
		return null;
	}

	return <a className='diff-behind' href={getBehindByUrl(component)}>{component.diff.behind_by} behind</a>;
};

export const CopyButton = ({component}) => {
	return <button
		type='button'
		className='btn-copy btn btn-primary btn-sm'
		data-clipboard-text={githubService.getShortlog(component.diff.commits)}>
		Copy
	</button>;
};

BehindByButton.propTypes = AheadByButton.propTypes = CopyButton.propTypes = {
	component: React.PropTypes.object.isRequired
};
