const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const sourcePath = process.env.SCENARIO_SOURCE_PATH || path.join(__dirname, '..', 'app', 'components', 'alerts-panel.tsx')
const source = fs.readFileSync(sourcePath, 'utf8')
const file = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

function visit(node, predicate) {
  if (predicate(node)) return node
  return ts.forEachChild(node, (child) => visit(child, predicate))
}

function alertsPanel() {
  return visit(file, (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'AlertsPanel')
}

function actionAttribute() {
  return visit(file, (node) => ts.isJsxAttribute(node) && node.name.text === 'action')
}

test('AlertsPanel has a typed permission input', () => {
  const panel = alertsPanel()
  assert.ok(panel, 'Export an AlertsPanel function.')
  const parameter = panel.parameters[0]
  assert.ok(parameter, 'AlertsPanel needs a props parameter.')
  assert.ok(ts.isObjectBindingPattern(parameter.name), 'Destructure props so the permission is explicit.')
  const permission = parameter.name.elements.find((element) => ts.isIdentifier(element.name) && element.name.text === 'canManageBilling')
  assert.ok(permission, 'Accept canManageBilling in AlertsPanel props.')
  assert.match(source, /canManageBilling\s*:\s*boolean/, 'Type canManageBilling as a boolean.')
})

test('billing action is protected by canManageBilling', () => {
  const attribute = actionAttribute()
  assert.ok(attribute?.initializer && ts.isJsxExpression(attribute.initializer), 'Provide action as a JSX expression.')
  const expression = attribute.initializer.expression
  assert.ok(expression && ts.isConditionalExpression(expression), 'Use a conditional action instead of always rendering the billing link.')
  assert.ok(ts.isIdentifier(expression.condition) && expression.condition.text === 'canManageBilling', 'Guard the action with canManageBilling.')
  assert.ok(ts.isJsxElement(expression.whenTrue) || ts.isJsxSelfClosingElement(expression.whenTrue), 'Keep a billing action for authorized users.')
  assert.ok(ts.isIdentifier(expression.whenFalse) && expression.whenFalse.text === 'undefined', 'Hide the action when the role lacks permission.')
})

test('source is syntactically valid TSX', () => {
  assert.equal(file.parseDiagnostics.length, 0, file.parseDiagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).join('\n'))
})
