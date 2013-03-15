angular.module('history.directives', [])
    .directive('kinetic', function($timeout) {
        return {
            restrict: 'E',
            replace: true,
            template: '<div id="container"></div>',
            link:function postLink($scope, iElement, iAttrs) {
                // create stage
                $scope.stage = new Kinetic.Stage({
                    container: 'container',
                    width: window.innerWidth,
                    height: window.innerHeight - $('.navbar').outerHeight()
                });

                // set and execute
                $scope.drawAll = function() {
                    for (var i = 0; i < $scope.pageViews.length; i++) {
                        // px to ms ratio
                        var ratio = (window.innerWidth - $scope.offset) / (1000 * 60 * $scope.range); // ratio = effective canvas / range in ms
                        var leftTime = (new Date()).getTime() - (1000 * 60 * $scope.range);              // leftTime = now - range in ms
                        var start = ratio * ($scope.pageViews[i].pageOpenTime - leftTime);
                        var end = $scope.pageViews[i].pageCloseTime ? ratio * ($scope.pageViews[i].pageCloseTime - leftTime) : window.innerWidth - $scope.offset;
                        $scope.drawNode(start, end, i * $scope.lineHeight, $scope.pageViews[i]);
                    }
                };

                $scope.$watch('pageViews', function() {
                    $scope.drawAll();
                    $scope.stage.setSize({
                        width: window.innerWidth,
                        height: $scope.lineHeight * $scope.pageViews.length
                    });
                }, true);

                $scope.drawNode = function(start, end, y, pageView) {
                    var layer = new Kinetic.Layer();
                    var group = new Kinetic.Group({
                        x: start,
                        y: y
                    });

                    var line = new Kinetic.Line({
                        points: [0, 15, end - start, 15],
                        stroke: end === window.innerWidth - $scope.offset ? 'blue' : 'black', // blue == still open
                        strokeWidth: 4
                    });

                    var url = pageView.pageUrl || 'Missing URL';
                    // truncate URLs loner than 50 chars
                    if (url.length > 50) {
                        url = url.substr(0, 50) + '...';
                    }

                    var text = new Kinetic.Text({
                        text: url,
                        fontSize: 13,
                        fontFamily: 'Arial',
                        fill: '#aaa',
                        width: 800,
                        x: start < 0 ? -1 * start : 0 // prevent text from falling off left side of screen
                    });

                    group.add(line);
                    group.add(text);
                    layer.add(group);
                    $scope.stage.add(layer);
                };

                // draw now line
                var layer = new Kinetic.Layer();
                var line = new Kinetic.Line({
                    points: [window.innerWidth - $scope.offset, 0, window.innerWidth - $scope.offset, 10000],
                    stroke: 'red',
                    strokeWidth: 2
                });
                layer.add(line);
                $scope.stage.add(layer);
                $scope.drawAll();
            },
            controller: Tree
        };
    })

;