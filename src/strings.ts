import { Parser, exact, many, many1, maybe, any, flatten4 } from "./parsers"
import { Stream } from "./streams"
import { Option } from "./options"

export type StringStream = Stream<string> & {
    tryTest(char: RegExp): Option<[string, StringStream]>
}

export type StringOptions = {
    caseInsensitive: boolean
}

export const DefaultOptions: StringOptions = {
    caseInsensitive: false,
}

const ciCollator = { sensitivity: 'accent' }

function equalCi(a: string, b: string) {
    return a.localeCompare(b, undefined, ciCollator) === 0
}

export module StringStream {

    export function create(input: string): StringStream
    export function create(input: string, options: StringOptions): StringStream
    export function create(input: string, options: StringOptions = DefaultOptions): StringStream {
        let stream = {
            tryTake(value: string): Option<[string, StringStream]> {
                if (!options.caseInsensitive && input.startsWith(value))
                    return [value, create(input.slice(value.length), this.options)]
                else if (options.caseInsensitive) {
                    let next = input.slice(0, value.length)
                    if (equalCi(next, value))
                        return [next, create(input.slice(value.length), this.options)]
                }

            },
            tryTest(char: RegExp): Option<[string, StringStream]> {
                let next = input.charAt(0)
                if (char.test(next))
                    return [next, create(input.slice(1), this.options)]
            },
            eof() {
                return !input
            },
            value: input,
            options: options
        }

        return stream
    }
}

// STRING DEFINITIONS

const wsExp = /\s/
const digitExp = /\d/
const letterExp = /\w/i

// STRING PARSERS

export function char(label: string, exp: RegExp): Parser<string, string> {
    return {
        label: label,
        parse: (stream: Stream<string>) => {
            return Option.match((stream as StringStream).tryTest(exp),
                some => Parser.success(some[0], some[1]),
                none => Parser.failure("", stream))

        },
    }
}

export const space = char("SPACE", wsExp)
export const letter = char("LETTER", letterExp)
export const digit = char("DIGIT", digitExp)

export const number =
    Parser.combine(maybe(any(exact("+"), exact("-"))))
        .and(many1(digit))
        .and(maybe(exact(".")))
        .and(many(digit))
        .map(flatten4)
        .map((a) => {
            const text = (a[0] || "") + (a[1].join("")) + (a[2] || "") + (a[3].join(""))
            return Number.parseFloat(text)
        })
        .build("NUMBER")
