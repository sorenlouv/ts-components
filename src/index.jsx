import { Router, Route, hashHistory } from 'react-router';
import React from 'react';
import { render } from 'react-dom';
import App from './modules/App.jsx';
import './styles/app.scss';

render(
	<Router history={hashHistory}>
		<Route path='/(:pullRequestNumber)' component={App} />
	</Router>,
	document.getElementById('app')
);
