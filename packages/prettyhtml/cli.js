#!/usr/bin/env node

'use strict'

const PassThrough = require('stream').PassThrough
const notifier = require('update-notifier')
const meow = require('meow')
const engine = require('unified-engine')
const unified = require('unified')
const report = require('vfile-reporter')
const { basename } = require('path')
const pack = require('./package')
const defaults = require('./defaults')
const prettier = require('prettier')

// processing
const parse = require('@starptech/prettyhtml-rehype-parse')
const stringify = require('@starptech/prettyhtml-formatter/stringify')
const format = require('@starptech/prettyhtml-formatter')

const extensions = ['html']

notifier({ pkg: pack }).notify()

var cli = meow(
  `
  Usage: prettyhtml [<glob> ...] [options ...],

  Options:

  --tab-width       Specify the number of spaces per indentation-level
  --use-tabs        Use tabs for indentation
  --print-width     Specify the line length that the printer will wrap on
  --stdin           Specify the standard stream as source (for pipe mode)
  --why             Output sources (when available)
  --quiet           Output only warnings and errors

  Examples
    $ prettyhtml *.html
    $ prettyhtml *.html !example.html
    $ echo "<custom foo='bat'></custom>" | prettyhtml --stdin
    $ echo "<custom foo='bat'></custom>" --stdin ./test.html
  `,
  {
    autoHelp: true,
    autoVersion: true,
    flags: {
      tabWidth: {
        type: 'number',
        default: 2
      },
      useTabs: {
        type: 'boolean',
        default: false
      },
      stdin: {
        type: 'boolean',
        default: false
      },
      printWidth: {
        type: 'number',
        default: 80
      },
      quiet: {
        type: 'boolean',
        default: true
      },
      why: {
        type: 'boolean'
      }
    }
  }
)

prettier
  .resolveConfig(process.cwd())
  .then(prettierOpts => {
    const settings = {
      processor: unified(),
      extensions: extensions,
      configTransform: transform,
      streamError: new PassThrough(), // sink errors
      rcName: '.prettyhtmlrc',
      packageField: 'prettyhtml',
      ignoreName: '.prettyhtmlignore',
      frail: true,
      defaultConfig: transform({ prettierOpts })
    }

    if (cli.flags.stdin === false) {
      if (cli.input.length === 0) {
        cli.showHelp()
      } else {
        settings.files = cli.input
        settings.output = true // Whether to overwrite the input files
        settings.out = false // Whether to write the processed file to streamOut

        engine(settings, processResult)
      }
    } else {
      if (cli.input.length !== 0) {
        settings.output = basename(cli.input[0])
      }
      engine(settings, processResult)
    }
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

function processResult(err, code, result) {
  const out = report(err || result.files, {
    verbose: cli.flags.why,
    quiet: cli.flags.quiet
  })

  if (out) {
    console.error(out)
  }

  process.exit(code)
}

function transform({ prettierOpts }) {
  const plugins = [
    [parse, defaults.parser],
    [
      format,
      {
        tabWidth: cli.flags.tabWidth,
        printWidth: cli.flags.printWidth,
        useTabs: cli.flags.useTabs,
        prettier: prettierOpts
      }
    ],
    [
      stringify,
      {
        tabWidth: cli.flags.tabWidth,
        printWidth: cli.flags.printWidth
      }
    ]
  ]
  return { plugins }
}
