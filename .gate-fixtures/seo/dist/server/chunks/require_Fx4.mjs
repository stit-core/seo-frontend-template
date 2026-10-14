// require вне dependencies — именем бандлера с суффиксом и результатом createRequire, импортированного
// под другим именем и взятого через объект.
import * as nodeModule from 'node:module'
import { createRequire as makeRequire } from 'node:module'
import { i as __require$1 } from './rolldown-runtime_Fx3.mjs'

export const ms = __require$1('ms')
export const kleur = makeRequire(import.meta.url)('kleur')
export const chalk = nodeModule.createRequire(import.meta.url)('chalk')
