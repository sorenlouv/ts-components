import React from 'react';
import _ from 'lodash';
import githubService from '../services/github';

function getUrl (component, prop) {
	return prop === 'ahead_by'
		? 'https://github.com/Tradeshift/' + component.name + '/compare/' + component.from + '...' + component.to
		: 'https://github.com/Tradeshift/' + component.name + '/compare/' + component.to + '...' + component.from;
}

function hasChanges (component, prop) {
	return _.get(component.diff, prop) > 0 && !hasOnlyMergeCommits(component);
}

function hasOnlyMergeCommits (component) {
	if (_.size(_.get(component.diff, 'commits')) === 0) {
		return false;
	}

	// Exclude diff if it only contains merge commits
	return !component.diff.commits.some(commit => !commit.commit.message.match(/Merge pull request #\d+ from Tradeshift/));
}

export function BehindByButton ({component, reverse}) {
	const prop = reverse ? 'ahead_by' : 'behind_by';

	if (!hasChanges(component, prop)) {
		return null;
	}

	return <a className='diff-behind' href={getUrl(component, prop)}>{component.diff[prop]} behind</a>;
}

export const AheadByButton = ({component, reverse}) => {
	const prop = reverse ? 'behind_by' : 'ahead_by';
	if (!hasChanges(component, prop)) {
		return null;
	}

	return <a className='diff-ahead' href={getUrl(component, prop)}>{component.diff[prop]} ahead</a>;
};

export const CopyButton = ({component, reverse}) => {
	const aheadProp = reverse ? 'behind_by' : 'ahead_by';
	const behindProp = reverse ? 'ahead_by' : 'behind_by';
	if (!hasChanges(component, behindProp) || hasChanges(component, aheadProp)) {
		return null;
	}

	return <button
		type='button'
		className='btn-copy btn btn-primary btn-sm'
		data-clipboard-text={githubService.getShortlog(component.diff.commits)}>
		<span className='glyphicon glyphicon glyphicon-copy' aria-hidden='true' />
	</button>;
};

BehindByButton.propTypes = AheadByButton.propTypes = CopyButton.propTypes = {
	component: React.PropTypes.object.isRequired
};
