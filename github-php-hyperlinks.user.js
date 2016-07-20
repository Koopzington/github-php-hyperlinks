// ==UserScript==
// @name         GitHub PHP Hyperlinks
// @namespace    https://github.com/Koopzington
// @version      0.3
// @description  Enhances browsing through PHP code on GitHub by linking referenced classes
// @author       koopzington@gmail.com
// @match        https://github.com/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    // Also execute this script if content is getting loaded via pjax
    document.addEventListener("pjax:complete", function () {
        start();
    });
    start();

    function start() {
        // Check if currently viewed file is a PHP file
        if (window.location.href.split('.php').length == 2) {
            // Grab reponame
            var repoName = window.location.href.split('/');
            var status = repoName[6];
            repoName = repoName[3] + '/' + repoName[4];
            var nsRoots = [];
            var dependencies = [];
            var imports = [];
            var filenamespace;
            parseFile();
        }

        function parseFile() {
            // Grab namespace of current class
            var namespaceXPath = "//span[@class='pl-k' and .='namespace']/following-sibling::span";
            filenamespace = document.evaluate(namespaceXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            // Check if file actually has a namespace
            if (filenamespace !== null) {
                // Now let's grab all use statements
                var useXpath = "//span[@class='pl-k' and .='use'][not(preceding::span[@class ='pl-k' and .='class'])]/following-sibling::span";
                var iterator = document.evaluate(useXpath, document, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
                var thisNode = iterator.iterateNext();

                while (thisNode) {
                    var newImport = {};
                    newImport.name = thisNode.textContent;
                    thisNode = iterator.iterateNext();
                    // Check if use statement has an alias
                    if (thisNode && thisNode.textContent == "as") {
                        thisNode = iterator.iterateNext();
                        newImport.alias = thisNode.textContent;
                        thisNode = iterator.iterateNext();
                    } else {
                        var split = newImport.name.split('\\');
                        newImport.alias = split[split.length - 1];
                    }
                    imports.push(newImport);
                }

                // Grab composer.json from current repo
                GM_xmlhttpRequest({
                    method: "GET",
                    url: "https://api.github.com/repos/" + repoName + '/contents/composer.json?ref=' + status,
                    onload: function (responseDetails) {
                        if (responseDetails.status == 200) {
                            var data = JSON.parse(atob(JSON.parse(responseDetails.responseText).content));
                            var req;
                            checkAutoload(data, repoName);
                            if (data.hasOwnProperty('require')) {
                                for (req in data.require) {
                                    dependencies.push(req);
                                }
                            }
                            if (data.hasOwnProperty('require-dev')) {
                                for (req in data['require-dev']) {
                                    dependencies.push(req);
                                }
                            }
                            addExternalRoots();
                        }
                    }
                });
            }
        }

        function addExternalRoots() {
            var promises = [];
            for (var i = 0; i < dependencies.length; ++i) {
                promises.push(getComposerOf(dependencies[i]));
            }
            Promise.all(promises).then(function () {
                grabFilesOnSameNamespace();
            });
        }

        function grabFilesOnSameNamespace() {
            // Find out root namespace of file
            var currentNamespace = filenamespace.innerHTML;
            var currentRoot;
            for (var ns in nsRoots) {
                if (currentNamespace.substring(0, nsRoots[ns].root.length - 1) + '\\' == nsRoots[ns].root) {
                    currentNamespace = currentNamespace.substring(nsRoots[ns].root.length);
                    currentRoot = nsRoots[ns];
                }
            }
            // Now we get all classes that are in the same namespace as our current class
            GM_xmlhttpRequest({
                method: "GET",
                url: "https://api.github.com/repos/" + repoName + '/contents/' + currentRoot.path + currentNamespace,
                onload: function (responseDetails) {
                    if (responseDetails.status == 200) {
                        var data = JSON.parse(responseDetails.responseText);
                        for (var i = 0; i < data.length; ++i) {
                            if (data[i].name.split('.php').length == 2) {
                                var classname = data[i].name.split('.php')[0];
                                imports.push({
                                    name: filenamespace.innerHTML + '\\' + classname,
                                    alias: classname
                                });
                            }
                        }
                    }
                    editDOM();
                }
            });
        }

        function getComposerOf(repo) {
            return new Promise(function (resolve, reject) {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: "https://packagist.org/p/" + repo + '.json',
                    onload: function (responseDetails) {
                        if (responseDetails.status == 200) {
                            var reqData = JSON.parse(responseDetails.responseText).packages[repo]['dev-master'];
                            checkAutoload(reqData);
                        }
                        resolve();
                    }
                });
            });
        }

        function checkAutoload(data, repoName) {
            if (data.hasOwnProperty('autoload')) {
                var path;
                var repo;
                if (repoName !== undefined) {
                    repo = repoName;
                } else {
                    repo = data.source.url.split('github.com/')[1].split('.git')[0];
                }
                if (data.autoload.hasOwnProperty('psr-4')) {
                    for (var ns4 in data.autoload['psr-4']) {
                        path = data.autoload['psr-4'][ns4];
                        if (path.substring(path.length - 1) != '/') {
                            path = path + '/';
                        }
                        nsRoots.push({
                            root: ns4,
                            path: path,
                            repo: repo
                        });
                    }
                }
                if (data.autoload.hasOwnProperty('psr-0')) {
                    for (var ns0 in data.autoload['psr-0']) {
                        path = data.autoload['psr-0'][ns0];
                        if (path.substring(path.length - 1) != '/') {
                            path = path + '/';
                        }
                        path = path + ns0.substring(0, ns0.length - 1) + '/';
                        path = path.replace(/\\/g, '/');
                        nsRoots.push({
                            root: ns0,
                            path: path,
                            repo: repo
                        });
                    }
                }
            }
        }

        function editDOM() {
            var currentRoot;
            var currentNamespace;
            var k;
            var toBeModified = [];
            var thisNode;
            var iterator;
            var currentStatus;

            for (var j = 0; j < imports.length; ++j) {
                currentRoot = undefined;
                currentNamespace = undefined;
                for (var ns in nsRoots) {
                    if (imports[j].name.substring(0, nsRoots[ns].root.length) == nsRoots[ns].root) {
                        currentNamespace = imports[j].name.substring(nsRoots[ns].root.length);
                        currentRoot = nsRoots[ns];
                    }
                }
                if (currentRoot !== undefined) {
                    if (currentRoot.repo == repoName) {
                        currentStatus = status;
                    } else {
                        currentStatus = 'master';
                    }
                    // Find all direct uses of the classes and replace the content with links
                    classXpath = "//span[.='" + imports[j].alias + "']";
                    iterator = document.evaluate(classXpath, document, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
                    thisNode = iterator.iterateNext();

                    while (thisNode) {
                        toBeModified.push(thisNode);
                        thisNode = iterator.iterateNext();
                    }
                    for (k = 0; k < toBeModified.length; ++k) {
                        toBeModified[k].innerHTML = '<a style="color: inherit;" href="https://github.com/' + currentRoot.repo + '/blob/' + currentStatus + '/' + currentRoot.path + currentNamespace + '.php">' + toBeModified[k].innerHTML + '</a>';
                    }

                    // Do the same thing again, but this time for subnamespaces (e.g. "Element\")
                    classXpath = "//span[@class='pl-c1' and .='" + imports[j].alias + "\\']";
                    iterator = document.evaluate(classXpath, document, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
                    thisNode = iterator.iterateNext();
                    toBeModified = [];
                    while (thisNode) {
                        toBeModified.push(thisNode);
                        thisNode = iterator.iterateNext();
                    }
                    for (k = 0; k < toBeModified.length; ++k) {
                        toBeModified[k].innerHTML = '<a style="color: inherit;" href="https://github.com/' + currentRoot.repo + '/tree/' + currentStatus + '/' + currentRoot.path + currentNamespace + '">' + toBeModified[k].innerHTML + '</a>';
                    }

                    // Do the same thing again, but this time for classes with subnamespaces (e.g. Element\Select::class
                    classXpath = "//span[@class='pl-c1' and .='" + imports[j].alias + "\\']/following-sibling::span[1]";
                    iterator = document.evaluate(classXpath, document, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
                    thisNode = iterator.iterateNext();
                    toBeModified = [];
                    while (thisNode) {
                        toBeModified.push(thisNode);
                        thisNode = iterator.iterateNext();
                    }
                    for (k = 0; k < toBeModified.length; ++k) {
                        toBeModified[k].innerHTML = '<a style="color: inherit;" href="https://github.com/' + currentRoot.repo + '/blob/' + currentStatus + '/' + currentRoot.path + currentNamespace + '/' + toBeModified[k].innerHTML + '.php">' + toBeModified[k].innerHTML + '</a>';
                    }

                    // Add a Hyperlink to the use statement
                    var classXpath = "//span[@class='pl-c1' and .='" + imports[j].name + "']";
                    var node = document.evaluate(classXpath, document, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null).singleNodeValue;
                    if (node !== null) {
                        // Use the amount of results of the upper search for subnamespace usages to determine if a link to a directory or to a file should be generated
                        if (toBeModified.length > 0) {
                            node.innerHTML = '<a style="color: inherit;" href="https://github.com/' + currentRoot.repo + '/tree/' + currentStatus + '/' + currentRoot.path + currentNamespace + '">' + node.innerHTML + '</a>';
                        } else {
                            node.innerHTML = '<a style="color: inherit;" href="https://github.com/' + currentRoot.repo + '/blob/' + currentStatus + '/' + currentRoot.path + currentNamespace + '.php">' + node.innerHTML + '</a>';
                        }
                    }
                }
            }
        }
    }
}());