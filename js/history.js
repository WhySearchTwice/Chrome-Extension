// Declare app level module which depends on filters, and services
angular.module('history', ['history.filters', 'history.services', 'history.directives'])
    .config(['$routeProvider', function($routeProvider) {
        $routeProvider.when('/tree', {
            templateUrl: '/html/history-tree.html'
        });
        $routeProvider.otherwise({redirectTo: '/tree'});
    }])
;
