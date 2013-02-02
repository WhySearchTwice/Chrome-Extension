(function() {
    'use strict';

    // Declare app level module which depends on filters, and services
    angular.module('history', ['history.filters', 'history.services', 'history.directives'])
        .config(['$routeProvider', function($routeProvider) {
            $routeProvider.when('/view1', {templateUrl: '/html/history-partial1.html', controller: MyCtrl1});
            $routeProvider.when('/view2', {templateUrl: '/html/history-partial2.html', controller: MyCtrl2});
            $routeProvider.otherwise({redirectTo: '/view1'});
        }])
    ;
})();
