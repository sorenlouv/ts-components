import React from 'react';
import _ from 'lodash';

export default function SelectedPullRequest ({pullRequest, onClickResetPullRequest}) {
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
