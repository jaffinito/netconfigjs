var fs = require('fs');

var Element = function(){
    this.elementName;
    this.elements = [];
    this.attributes = [];
    this.annotation;
    this.pElement;
    this.minOccurs;
    this.maxOccurs;
    this.value;
};

var Attribute = function () {
    this.attributeName;
    this.defaultValue;
    this.type;
    this.annotation;
    this.pElement;
    this.value;
    this.restriction = [];
    //will need to handle restrictions as well
};

var xsdProcessor = {
    readXsd:function (){
        //https://github.com/Leonidas-from-XIV/node-xml2js
        var parseString = require('xml2js').parseString;
        var contents = fs.readFileSync("./newrelic.xsd", "utf8");
        var myresults;
        parseString(contents, function (err, result) {
            myresults = result;
        });
        //what the loop sees
        //console.log(myresults['xs:schema']['xs:element'][0]);
        return xsdProcessor.processXsd(myresults['xs:schema'], null);
    },

    processXsd : function (xsValue, element){
        //this reads the xml and sends our the individual elements for additional processing
        if(xsValue.hasOwnProperty("xs:element")){

            //build the configuration element by hand since it will always exist.
            var xsElement = xsValue["xs:element"][0];
            var element = new Element();
            element.elementName = xsElement["$"].name;
            element.annotation = xsdProcessor.getAnnotation(xsElement);
            xsdProcessor.setOccurs(xsElement, element);

            var complex = xsElement["xs:complexType"][0];
            xsdProcessor.processAttributes(complex, element);
            var innerNode = complex["xs:all"][0];

            for(var i = 0;i<innerNode["xs:element"].length;i++){
                xsdProcessor.processElement(innerNode["xs:element"][i], element);
            }

            return element;
        }
    },

    processElement : function (xsElement, pElement){
        //console.log(xsElement["$"].name);
        //this == parent element

        //setup the element being created this pass
        var element = new Element();

        if(typeof pElement !== "undefined"){
            element.pElement = pElement;
        }

        //gets the name of the element
        element.elementName = xsElement["$"].name;

        //capture annotations
        element.annotation = xsdProcessor.getAnnotation(xsElement);

        //set min and max Occurs
        xsdProcessor.setOccurs(xsElement, element);

        //pull the complexType out
        var complex;
        if(xsElement.hasOwnProperty("xs:complexType")) {
            complex = xsElement["xs:complexType"][0];
        }

        if(typeof complex !== "undefined"){
            xsdProcessor.processAttributes(complex, element);

            //discover and select the new level then loop over the child elements
            var innerNode;
            if(complex.hasOwnProperty("xs:all")) innerNode = complex["xs:all"][0];
            else if(complex.hasOwnProperty("xs:sequence")) innerNode = complex["xs:sequence"][0];
            if(typeof innerNode !== "undefined" && innerNode.hasOwnProperty("xs:element"))
                for(var i = 0;i<innerNode["xs:element"].length;i++){
                    xsdProcessor.processElement(innerNode["xs:element"][i], element);
                }
        }

        //add to parent if not empty
        if(typeof pElement !== "undefined" && pElement.elementName) pElement.elements.push(element);

        //output for testing
        //console.log(element);
    },

    processAttributes : function (complex, element){
        //use this. to access element
        if(!complex.hasOwnProperty("xs:attribute")) return;
        var attributesArray = complex["xs:attribute"];
        for(var i = 0;i < attributesArray.length;i++){
            var attribute = new Attribute();
            attribute.attributeName = attributesArray[i]["$"].name;
            attribute.pElement = element;
            attribute.annotation = xsdProcessor.getAnnotation(attributesArray[i]);
            attribute.defaultValue = attributesArray[i]["$"]["default"];

            if(attributesArray[i].hasOwnProperty("xs:simpleType")){
                attribute.type = "restriction";
                attributesArray[i]["xs:simpleType"][0]["xs:restriction"][0]["xs:enumeration"].forEach(function(enumeration){
                    attribute.restriction.push(enumeration["$"]["value"]);
                });
            }
            else{
                attribute.type = attributesArray[i]["$"].type;
            }

            element.attributes.push(attribute);
        }
    },

    getAnnotation : function (xsItem){
        //capture annotations
        if(xsItem.hasOwnProperty("xs:annotation")) {
            return xsItem["xs:annotation"][0]["xs:documentation"][0];
        }
        if(!xsItem.hasOwnProperty("xs:complexType")) return;
        if(xsItem["xs:complexType"][0].hasOwnProperty("xs:annotation")){
            return xsItem["xs:complexType"][0]["xs:annotation"][0]["xs:documentation"][0];
        }
    },

    setOccurs : function (xsElement, element){
        element.minOccurs = (xsElement["$"].hasOwnProperty("minOccurs")) ? parseInt(xsElement["$"]["minOccurs"]) : 1;
        element.maxOccurs = (xsElement["$"].hasOwnProperty("maxOccurs")) ? parseInt(xsElement["$"]["maxOccurs"]) : 1;
        //fix NaN from unbounded maxOccurs
        element.maxOccurs = (isNaN(element.maxOccurs)) ? 10000 : element.maxOccurs;
    }
};

var configProcessor = {
    readXml:function (){
        //https://github.com/Leonidas-from-XIV/node-xml2js
        var parseString = require('xml2js').parseString;
        var contents = fs.readFileSync("./newrelic.config", "utf8");
        var myresults;
        parseString(contents, function (err, result) {
            myresults = result;
        });
        //what the loop sees
        //console.log(myresults);

        return configProcessor.processXml(myresults, null);
    },

    processXml : function (xsValue, element){
        //this reads the xml and sends our the individual elements for additional processing
        if(xsValue.hasOwnProperty("configuration")){
            var element = new Element();
            element.elementName = "configuration";

            //attributes
            configProcessor.processAttributes(xsValue["configuration"]["$"],element);
            for(var prop in xsValue["configuration"]){
                if(prop != "$") configProcessor.processElement(xsValue["configuration"][prop][0], prop, element);
            }
        }
        return element;
    },

    processElement : function (xsElement, name, pElement) {
        //setup the element being created this pass
        var element = new Element();

        if(name != "configuration")element.pElement = pElement;

        //gets the name of the element
        element.elementName = name;

        //attributes
        if(xsElement.hasOwnProperty("$")) configProcessor.processAttributes(xsElement["$"],element);

        //child elements
        for(var prop in xsElement){
            if(prop != "$" && typeof xsElement[prop] != "string"){
                for(var i = 0;i < xsElement[prop].length; i++){
                    configProcessor.processElement(xsElement[prop][i], prop, element);
                }
            }
        }
        //console.log(xsValue);
        if(typeof xsElement == "string") element.value = xsElement;

        //add to parent if not empty
        if(pElement.elementName) pElement.elements.push(element);
    },

    processAttributes : function (xsElement, element){
        for(var prop in xsElement){
            var attribute = new Attribute();
            attribute.attributeName = prop;
            attribute.value = xsElement[prop]
            element.attributes.push(attribute);
        }
    }
};

function getElementByPath(path, element){
    var steps = path.split('.');
    if(steps[steps.length - 1] == "configuration") steps.pop();
    var itemToFind = steps.pop();
    var selectedElement = element;
    for(var i =0;i<element.elements.length;i++){
        if(element.elements[i].elementName == itemToFind) {
            selectedElement = getElementByPath(steps.join('.'), element.elements[i]);
            break;
        }
    }
    return selectedElement;
}
