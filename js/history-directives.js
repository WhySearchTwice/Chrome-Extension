angular.module('history.directives', [])
    .directive('kinetic', function() {
        var kineticContainer = '<div ng-dblclick="drawShapes()" id="container"></div>';
        return {
            restrict: 'E',
            compile:function (tElement, tAttrs, transclude) {
                tElement.html(kineticContainer);
            },
            controller: KineticCtrl
        };
    });