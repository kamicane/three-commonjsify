/* eslint no-console: 0 */
"use strict";

// FS
var fs = require("fs");
var mkdirp = require("mkdirp");

// ASYNC
var Promise = require("promise");

// AST
var espree = require("espree");
var escodegen = require("escodegen");
var nodes = require("nodes");

// PATH
var minimist = require("minimist");
var pathogen = require("pathogen");

// ... //

var types = nodes.types;

var readdir = Promise.denodeify(fs.readdir);
var readFile = Promise.denodeify(fs.readFile);
mkdirp = Promise.denodeify(mkdirp);
var writeFile = Promise.denodeify(fs.writeFile);

// ... //

var threePath = "./Three.js";

var argv = minimist(process.argv.slice(2));

var inputPath = argv.input;
var outputPath = argv.output;
var graphPath = argv.graph;

if (!inputPath) {
  console.error("MISSING input path (--input)");
  process.exit(0);
}

if (!outputPath) {
  console.error("MISSING output path (--output)");
  process.exit(0);
}

if (graphPath) graphPath = pathogen(graphPath);
inputPath = pathogen(inputPath + "/");
outputPath = pathogen(outputPath + "/");

// util

var write = function(filePath, fileSource) {
  var fullPath = pathogen.resolve(filePath);

  var outputDir = pathogen.sys(pathogen.dirname(fullPath));
  var outputFile = pathogen.sys(fullPath);

  return mkdirp(outputDir).then(function() {
    return writeFile(outputFile, fileSource);
  }).then(function() {
    console.warn("written", outputFile);
  });
};

var express = function(string) {
  return nodes.build(espree.parse(string, { ecmaFeatures: { globalReturn: true } }).body[0]);
};

var getUniqueName = function(file, name) {
  var names = file.names;

  while (~names.indexOf(name)) name = "_" + name;
  names.push(name);
  return name;
};

var parse = function(string, path) {
  var ast, error;

  try {
    ast = espree.parse(string, { range: true, tokens: true, comment: true });
    escodegen.attachComments(ast, ast.comments, ast.tokens);
  } catch(err) {
    console.error("error parsing", path);
    error = err;
  }

  if (error) throw error;
  return ast;
};

var generate = function(program, path) {
  var generated, error;

  try {
    generated = escodegen.generate(program, {
      format: {
        indent: { style: "\t" },
        quotes: "single"
      },
      comment: true
    });
  } catch(err) {
    console.error("error generating", path);
    error = err;
  }

  if (error) throw error;

  return generated;
};

// main collection
var files = {};

// shader chunk strings
var shaderChunks = {};

var GID = 0;

var save = function(filePath, relativeTo) {
  return readFile(pathogen.sys(filePath), { encoding: "utf8" }).then(function(contents) {
    var relativePath = pathogen.relative(relativeTo, filePath);

    var ext = pathogen.extname(filePath);

    if (ext === ".glsl") {
      var basename = pathogen.basename(filePath).replace(/\.glsl$/, "");
      shaderChunks[basename] = contents;
    } else if (ext === ".js") {
      var ast = parse(contents, relativePath);

      var program = nodes.build(ast);

      files[relativePath] = {
        id: GID++,
        program: program,
        path: relativePath,
        basename: pathogen.basename(relativePath).replace(/\.js$/, ""),
        names: program.search("#Identifier:declaration > name, #Identifier:reference > name"),
        provides: {},
        requires: {}
      };
    }
  });
};

// combine shader chunk strings into ShaderChunk.js
var combineShaderChunks = function() {

  var file = files["./renderers/shaders/ShaderChunk.js"];
  if (!file) return;

  var program = file.program;

  var objectExpression = program.body[0].expression.right;

  var properties = [];

  for (var name in shaderChunks) {
    var property = new types.Property({
      key: new types.Literal({ value: name }),
      value: new types.Literal({ value: shaderChunks[name] }),
      kind: "init"
    });
    properties.push(property);
  }

  objectExpression.properties.append(properties);
};

// async recursive walk directories
var unpack = function(dir, relativeTo) {
  if (!relativeTo) relativeTo = dir;

  return readdir(pathogen.sys(dir)).then(function(entries) {
    var promises = [];

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var full = dir + entry;
      if (pathogen.extname(entry)) promises.push(save(full, relativeTo));
      else promises.push(unpack(full + "/", relativeTo));
    }
    return Promise.all(promises);
  });
};

// lookup by definition
var definitions = {};

var graph = function() {

  var nodes = [];
  var edges = [];

  var path, file;

  // create nodes
  for (path in files) {
    file = files[path];

    var group = pathogen.dirname(path).replace(/^\.\//, "").replace(/\/$/, "");

    nodes.push(file.node = {
      id: file.id,
      label: file.basename,
      group: group,
      value: 0
    });
  }

  for (path in files) {
    file = files[path];
    var required = getRequiredFiles(file);
    for (var dpath in required) {
      var dfile = files[dpath];
      edges.push({ from: file.id, to: dfile.id });
      dfile.node.value++;
    }

  }

  return JSON.stringify({
    nodes: nodes,
    edges: edges
  }, null, 2);
};

// gets files required by file, indexed by filePath and providing an array of required names.
var getRequiredFiles = function(file) {
  var files = {};
  for (var name in file.requires) {
    var requiredFile = definitions[name];
    var requiredFilePath = requiredFile.path;
    var ref = files[requiredFilePath] || (files[requiredFilePath] = []);
    ref.push(name);
  }
  return files;
};

// checks if requiredFile depends on file, or any file required by requiredFile depend on file.
var hasDeepDependency = function(file, requiredFile, checked) {
  if (!checked) checked = {};

  if (checked[requiredFile.path]) return false;

  checked[requiredFile.path] = true;

  for (var name in requiredFile.requires) {
    var innerRequired = definitions[name];
    if (innerRequired === file) return true;
    if (hasDeepDependency(file, innerRequired, checked)) return true;
  }

  return false;

};

var checkDependencyIntegrity = function() {

  for (var path in files) {
    var file = files[path];
    for (var name in file.requires) {
      if (!definitions[name]) {
        console.warn("IGNORED", path, "(missing", name, "definition)");
        delete files[path];
      }
    }
  }
};

var nativeInstanceOfChecks = [
  "Array",
  "ArrayBuffer",
  "Uint32Array",
  "Uint16Array",
  "String",
  "Function",
  "RegExp",
  "Number",
  "PositionSensorVRDevice",
  "HMDVRDevice"
];

var nukeInstanceOf = function(file) {

  var program = file.program;

  var found = false;
  var foundNative = false;
  var instanceName = getUniqueName(file, "instance");
  var toStringName = getUniqueName(file, "toString");

  program.search("#BinaryExpression[operator=instanceof]").forEach(function(expression) {
    var right = expression.right;
    var left = expression.left;

    var newExpression;

    if (right.type === "MemberExpression" && right.object.type === "Identifier" && right.object.name === "THREE" && !right.computed && right.property.type === "Identifier") {
      found = true;

      newExpression = express("!!(" + instanceName + " = $) && !!(" + instanceName + ".is" + right.property.name + ")").expression;
      newExpression.left.argument.argument.right = left;
      expression.parentNode.replaceChild(expression, newExpression);
    } else if (right.type === "Identifier" && ~nativeInstanceOfChecks.indexOf(right.name)) {
      foundNative = true;

      newExpression = express(toStringName + ".call($).slice(8, -1) === '" + right.name + "'").expression;
      newExpression.left.callee.object.arguments.splice(0, 1, left);
      expression.parentNode.replaceChild(expression, newExpression);
    }
  });

  if (found) program.body.unshift(express("var " + instanceName));
  if (foundNative) program.body.unshift(express("var " + toStringName + " = Object.prototype.toString"));
};

// var literalProvides = {};

var markDependencies = function(file) {

  var fileProvides = file.provides;
  var fileRequires = file.requires;

  var program = file.program;
  var path = file.path;

  nukeInstanceOf(file);

  // var threeFile = files[threePath];

  // Three.js exports REVISION too, assigned to the THREE Object
  if (path === threePath) fileProvides.REVISION = { expressions: [], type: "Literal" };

  var name;

  var invalid = false;

  // provides
  program.search("#AssignmentExpression > left#MemberExpression > object#Identifier[name=THREE] < *").forEach(function(expression) {
    if (invalid) return;

    name = expression.property.name;

    if (expression.computed) {
      console.warn("IGNORED", path, "(computed assignment)");
      invalid = true;
      return;
    }

    var assignment = expression.parentNode;
    var right = assignment.right;

    var provideType = right.type;

    var provide = { expressions: [], type: provideType };

    fileProvides[name] = provide;
  });

  if (!invalid && path !== threePath) program.search("#MemberExpression > object#Identifier[name=THREE] < *").forEach(function(expression) {
    if (invalid) return;

    name = expression.property.name;

    if (expression.computed) {
      console.warn("IGNORED", path, "(computed expression)");
      invalid = true;
      return;
    }

    if (!fileProvides[name]) {
      // if this file does not provide the property, treat it as required, save the expression.

      var r = fileRequires[name] || (fileRequires[name] = { expressions: [] });
      r.expressions.push(expression);
    } else {
      // if this file provides the property, save the expression.

      var p = fileProvides[name];
      p.expressions.push(expression);
    }

    expression.object = new types.Identifier({ name: "$" }); // mark
  });

  if (!invalid && path !== threePath) {

    var refCount = program.search("#Identifier[name=THREE]").length;

    if (refCount > 0) {
      console.warn("IGNORED", path, "(THREE is still referenced)");
      invalid = true;
    }

  }

  if (invalid) {
    delete files[path];
    return;
  }

  for (name in fileProvides) {
    if (definitions[name]) console.warn("REDEFINITION of", name, "in", path, "previously defined in", definitions[name].path);
    definitions[name] = file;
  }
};

var globalIndexProgram = new types.Program;

var isObjectType = function(type) {
  return type === "FunctionExpression" || type === "ObjectExpression" || type === "ArrayExpression";
};

var commonjsify = function(file) {

  var path = file.path;
  var provides = file.provides;
  var requires = file.requires;
  var program = file.program;
  var basename = file.basename;

  var name, expressions, expression, i, j;

  var provideList = [];

  for (name in provides) {
    provideList.push(name);

    // do not rewrite Three.js, as it already has module.exports
    if (path === threePath) continue;

    var defineName;

    var def = provides[name];
    expressions = def.expressions;
    var defType = def.type;
    var isSafeToVar = isObjectType(defType);

    if (isSafeToVar) {
      defineName = getUniqueName(file, name);
      var defineDeclaration = express("var " + defineName);
      program.body.unshift(defineDeclaration);
    }

    for (i = 0; i < expressions.length; i++) {
      expression = expressions[i];
      if (isSafeToVar) expression.parentNode.replaceChild(expression, new types.Identifier({ name: defineName }));
      else expression.object = new types.Identifier({ name: "exports" });
    }

    var typeAssignment;

    if (defType === "FunctionExpression") {

      typeAssignment = express(defineName + ".prototype.is" + name + " = true");
      program.body.push(typeAssignment);

    } else if (defType !== "Literal" && defType !== "ObjectExpression" && defType !== "ArrayExpression") {
      typeAssignment = express("if (typeof exports." + name + " === 'function') exports." + name + ".prototype.is" + name + " = true");
      program.body.push(typeAssignment);
    }

    if (isSafeToVar) {
      var exportDeclaration = express("exports." + name + " = " + defineName);
      program.body.push(exportDeclaration);
    }
  }

  var requiredFiles = getRequiredFiles(file);

  for (var requiredFilePath in requiredFiles) {
    var requiredNames = requiredFiles[requiredFilePath];
    var requiredFile = files[requiredFilePath];

    var relativeRequiredPath = pathogen.relative(path, requiredFilePath).replace(/\.js$/, "");

    var moduleName = getUniqueName(file, requiredFilePath === threePath ? "Three" : requiredFile.basename + "Module");
    var getModuleName;

    var getRequireDeclaration;

    var isCircularDependency = hasDeepDependency(file, requiredFile);

    if (isCircularDependency) {

      getModuleName = getUniqueName(file, "get" + requiredFile.basename + "Module");
      getRequireDeclaration = express(
        "var " + moduleName + ", " + getModuleName + " = function() { return " + moduleName + " = require('" + relativeRequiredPath + "') }"
      );

    } else {
      getRequireDeclaration = express(
        "var " + moduleName + " = require('" + relativeRequiredPath + "')"
      );
    }

    for (i = 0; i < requiredNames.length; i++) {
      name = requiredNames[i];

      expressions = requires[name].expressions;
      for (j = 0; j < expressions.length; j++) {
        expression = expressions[j];
        if (isCircularDependency) {
          expression.object = new types.LogicalExpression({
            operator: "||",
            left: new types.Identifier({ name: moduleName }),
            right: new types.CallExpression({ callee: new types.Identifier({ name: getModuleName }) })
          });
        } else {
          expression.object = new types.Identifier({ name: moduleName });
        }
      }

    }

    program.body.unshift(getRequireDeclaration);

  }

  var pathWithoutExt = path.replace(/\.js$/, "");

  // write index data
  if (provideList.length === 1) {
    name = provideList[0];
    globalIndexProgram.body.push(express(
      "exports." + name + " = require('" + pathWithoutExt + "')." + name
    ));
  } else if (provideList.length > 1) {
    globalIndexProgram.body.push(express("var " + basename + " = require('" + pathWithoutExt + "')"));

    for (i = 0; i < provideList.length; i++) {
      name = provideList[i];
      globalIndexProgram.body.push(express("exports." + name + " = " + basename + "." + name));
    }
  }

  return program;
};

var rewrite = function(file) {
  var program = commonjsify(file);
  var source = generate(program, file.path);
  return write(pathogen.resolve(outputPath, file.path), source);
};

// writes a main index.js file that exports everything
var writeIndex = function() {
  var indexJS = "./index.js";
  var source = generate(globalIndexProgram, indexJS);
  return write(pathogen.resolve(outputPath, indexJS), source);
};

// writes the package.json manifest
var writePackageJSON = function() {
  var inputFile = pathogen.sys(pathogen.resolve("./dist/package.json"));
  return readFile(inputFile, { encoding: "utf8" }).then(function(source) {
    return write(pathogen.resolve(outputPath, "./package.json"), source);
  });
};

// writes the README.md file
var writeReadme = function() {
  var inputFile = pathogen.sys(pathogen.resolve("./dist/README.md"));
  return readFile(inputFile, { encoding: "utf8" }).then(function(source) {
    return write(pathogen.resolve(outputPath, "./README.md"), source);
  });
};

// writes the dependency graph JSON object
var writeGraph = function() {
  return write(graphPath, graph());
};

unpack(inputPath).then(combineShaderChunks).then(function() {

  var promises = [], path;

  for (path in files) {
    markDependencies(files[path]);
  }

  checkDependencyIntegrity();

  for (path in files) {
    promises.push(rewrite(files[path]));
  }

  return Promise.all(promises);

}).then(writeIndex).then(writePackageJSON).then(writeReadme).then(function() {
  if (graphPath) return writeGraph();
}).catch(function(error) {
  process.nextTick(function() {
    throw error;
  });
});
