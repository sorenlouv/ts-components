import Autosuggest from 'react-autosuggest';
import _ from 'lodash';
import React, {Component} from 'react';
import githubService from '../services/github';

const getSuggestionValue = suggestion => {
	return suggestion.number.toString() + ' - ' + suggestion.title;
};

const renderSuggestion = suggestion => (
	<div>
		<span className='image'><img src={suggestion.user.avatar_url + '&s=30'} /></span>
		<span className='number'>{suggestion.number}</span>
		<span className='title'>{suggestion.title}</span>
	</div>
);

export default class PullRequestCompleter extends Component {
	constructor () {
		super();

		this.state = {
			suggestions: [],
			query: ''
		};

		this.onSuggestionsFetchRequestedThrottled = _.throttle(this.onSuggestionsFetchRequested.bind(this), 500);
	}

	onSuggestionsFetchRequested ({ value }) {
		githubService.searchPullRequests(value).then(res => {
			this.setState({
				suggestions: res.items.slice(0, 10)
			});
		});
	}

	onChange (event, { newValue }) {
		this.setState({
			query: newValue
		});
	}

	onSuggestionSelected (event, { suggestion }) {
		this.props.onSelectPullRequest(suggestion);
		this.setState({
			query: ''
		});
	}

	onSuggestionsClearRequested () {
		this.setState({
			suggestions: []
		});
	}

	render () {
		const inputProps = {
			placeholder: 'Search for pull requests',
			value: this.state.query,
			onChange: this.onChange.bind(this)
		};

		return (
			<Autosuggest
				suggestions={this.state.suggestions}
				onSuggestionsFetchRequested={this.onSuggestionsFetchRequestedThrottled.bind(this)}
				onSuggestionsClearRequested={this.onSuggestionsClearRequested.bind(this)}
				getSuggestionValue={getSuggestionValue}
				renderSuggestion={renderSuggestion}
				onSuggestionSelected={this.onSuggestionSelected.bind(this)}
				shouldRenderSuggestions={() => true}
				inputProps={inputProps}
			/>
		);
	}
}
