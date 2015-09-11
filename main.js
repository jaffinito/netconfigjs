/**
 * Created by Inerion on 9/10/2015.
 */
var fs = require('fs');
var configTool = angular.module('configTool', ['ui.bootstrap']);

configTool.controller("firstCont", function($scope){
    $scope.elements = [];
    $scope.elements.push(xsdProcessor.readXsd());
    $scope.elements.push.apply($scope.elements, xsdProcessor.readXsd().elements);
    $scope.oneAtATime = true;
});