import React, {Component} from 'react';
import githubService from '../services/github';

export default class App extends Component {
	constructor (props) {
		super(props);
		this.state = {
			isAuthPending: true
		};

		githubService.init();
		githubService.onAuthStateChanged(user => {
			githubService.isAccessTokenValid().then(isValid => {
				if (isValid) {
					this.setState({
						isAuthPending: false
					});
					this.props.onAuthenticate();
				} else {
					this.setState({
						isAuthPending: false
					});
				}
			});
		});
	}

	onClickLogin () {
		githubService.authenticate();
	}

	render () {
		if (this.state.isAuthPending) {
			return <div className='loading-spinner'><img src='spinner.gif' /></div>;
		}

		return (
			<button type='button' className='github-login btn btn-default btn-lg' onClick={this.onClickLogin}>
				<img src='github-icon.png' width='30' /> Sign in with Github
			</button>
		);
	}
};
