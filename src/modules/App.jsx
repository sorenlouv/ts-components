import React, {Component} from 'react';
import LoginButton from './LoginButton.jsx';
import MainContainer from './MainContainer.jsx';

export default class App extends Component {
	constructor (props) {
		super(props);
		this.state = {
			isAuthenticated: false
		};
	}

	onAuthenticate () {
		this.setState({
			isAuthenticated: true
		});
	}

	render () {
		if (!this.state.isAuthenticated) {
			return <LoginButton onAuthenticate={this.onAuthenticate.bind(this)} />;
		} else {
			return <MainContainer pullRequestNumber={this.props.params.pullRequestNumber} />;
		}
	}
}
