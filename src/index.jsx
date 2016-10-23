import { Router, Route, useRouterHistory } from 'react-router';
import React from 'react';
import { render } from 'react-dom';
import App from './modules/App.jsx';
import { createHashHistory } from 'history';
import './styles/app.scss';

const appHistory = useRouterHistory(createHashHistory)({ queryKey: false });
render(
	<Router history={appHistory}>
		<Route path='/(:pullRequestNumber)' component={App} />
	</Router>,
	document.getElementById('app')
);
