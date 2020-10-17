import { Results, Result, Option } from "bplus-composer"
import { Stream } from "./streams"

export type Parsed<I, O> = {
    value: O,
    remaining: Stream<I>
}

export type Failed<I> = {
    error: string,
    remaining: Stream<I>
}

export type ParseResult<I, O> = Results<Parsed<I, O>, Failed<I>>
export type Parse<I, O> = (stream: Stream<I>) => ParseResult<I, O>
export type Map<A, B> = (a: A) => B

export type Parser<I, O> = {
    label: string,
    parse: Parse<I, O>
}

export type Builder<I, O> = {
    and<T>(b: Parser<I, T>): Builder<I, [O, T]>,
    take<T>(b: Parser<I, T>): Builder<I, T>,
    skip<T>(b: Parser<I, T>): Builder<I, O>,
    map<T>(m: Map<O, T>): Builder<I, T>,
    build(label?: string): Parser<I, O>
}

type SuccessDebugger<I, O> = (value: O, remaining: Stream<I>) => void
type FailureDebugger<I> = (error: string, remaining: Stream<I>) => void

export module Parser {

    export function create<I, O>(label: string, parser: (s: Stream<I>) => ParseResult<I, O>): Parser<I, O> {
        return {
            label: label,
            parse: (stream: Stream<I>) => {
                if (stream.eof())
                    return failure(label, "EOF", stream)
                else
                    return Result.match(parser(stream),
                        success => Parser.success(success.value, success.remaining),
                        failure => Parser.failure(label, "Expected: " + label, failure.remaining))
            }
        }
    }

    export function combine<I, O>(parser: Parser<I, O>): Builder<I, O> {
        const a = parser

        return {
            and: <T>(b: Parser<I, T>) => combine(and(a, b)),
            take: <T>(b: Parser<I, T>) => combine(take(a, b)),
            skip: <T>(b: Parser<I, T>) => combine(skip(a, b)),
            map: <T>(m: Map<O, T>) => combine(map(a, m)),
            build: (label?: string) => labeled(label || "", a)
        }
    }

    export function success<I, O>(value: O | undefined, stream: Stream<I>): ParseResult<I, O> {
        return Result.success({
            value: <O>value,
            remaining: stream
        })
    }

    export function failure<I, O>(label: string, message: string, remaining: Stream<I>): ParseResult<I, O> {
        let f: Failed<I> = {
            error: message,
            remaining: remaining
        }
        return Result.failure(f)
    }

    export function refail<I, O>(label: string, f: Failed<I>): ParseResult<I, O> {
        return failure(label, f.error, f.remaining)
    }
}

export module ParseResult {

    // kinda lame
    export function remaining<I, O>(result: ParseResult<I, O>): Stream<I> {
        return Result.match(result,
            success => success.remaining,
            failure => failure.remaining)
    }
}

// GENERIC PARSER COMBINATORS

export function andL<I, A, B>(label: string, parserA: Parser<I, A>, parserB: Parser<I, B>): Parser<I, [A, B]> {
    return Parser.create(label, (stream: Stream<I>) =>
        Result.match(parserA.parse(stream),
            success1 => Result.match(parserB.parse(success1.remaining),
                success2 => Parser.success([success1.value, success2.value], success2.remaining),
                failure2 => Parser.refail(label, failure2)),
            failure1 => Parser.refail(label, failure1)))
}

export function and<I, A, B>(parserA: Parser<I, A>, parserB: Parser<I, B>): Parser<I, [A, B]> {
    return andL(`${parserA.label} AND ${parserB.label}`, parserA, parserB)
}

export function skipL<I, A, B>(label: string, parserA: Parser<I, A>, parserB: Parser<I, B>): Parser<I, A> {
    return Parser.create(label, (stream: Stream<I>) =>
        Result.match(parserA.parse(stream),
            success1 => Result.match(parserB.parse(success1.remaining),
                success2 => Parser.success(success1.value, success2.remaining),
                failure2 => Parser.refail(label, failure2)),
            failure1 => Parser.refail(label, failure1)))
}

export function skip<I, A, B>(parserA: Parser<I, A>, parserB: Parser<I, B>): Parser<I, A> {
    return skipL(`TAKE ${parserA.label} AND SKIP ${parserB.label}`, parserA, parserB)
}

export function takeL<I, A, B>(label: string, parserA: Parser<I, A>, parserB: Parser<I, B>): Parser<I, B> {
    return Parser.create(label, (stream: Stream<I>) =>
        Result.match(parserA.parse(stream),
            success => parserB.parse(success.remaining),
            failure => Parser.refail(label, failure)))
}

export function take<I, A, B>(parserA: Parser<I, A>, parserB: Parser<I, B>): Parser<I, B> {
    return takeL(`SKIP ${parserA.label} AND TAKE ${parserB.label}`, parserA, parserB)
}

// GENERIC PARSER MODIFIERS

export function maybeL<I, O>(label: string, parser: Parser<I, O>): Parser<I, O> {
    /* NOTE: no Parser.create here because we do not want the EOF check to fail
     *       before this parser runs if it is the last parser
     */
    return {
        label: label,
        parse: (stream: Stream<I>) =>
            Result.match(parser.parse(stream),
                success => Parser.success(success.value, success.remaining),
                failure => Parser.success<I, O>(undefined, failure.remaining))
    }
}

export function maybe<I, O>(parser: Parser<I, O>): Parser<I, O> {
    return maybeL(`MAYBE ${parser.label}`, parser)
}

export function manyL<I, O>(label: string, parser: Parser<I, O>): Parser<I, O[]> {
    /* NOTE: no Parser.create here because we do not want the EOF check to fail
     *       before this parser runs if it is the last parser
     */
    return {
        label: label,
        parse: (stream: Stream<I>) => {
            let keepon = true
            let found: O[] = []
            let remaining = stream
            while (keepon) {
                keepon = Result.match(parser.parse(remaining),
                    success => { found.push(success.value); remaining = success.remaining; return true },
                    failure => false)
            }

            return Parser.success(found, remaining)
        }
    }
}

export function many<I, O>(parser: Parser<I, O>): Parser<I, O[]> {
    return manyL(`ZERO OR MANY ${parser.label}`, parser)
}

export function many1L<I, O>(label: string, parser: Parser<I, O>): Parser<I, O[]> {
    return Parser.create(label, (stream: Stream<I>) =>
        Result.match(parser.parse(stream),
            success1 => Result.match(many(parser).parse(success1.remaining),
                success2 => Parser.success([success1.value].concat(success2.value), success2.remaining),
                failure2 => Parser.refail(label, failure2)),
            failure1 => Parser.refail(label, failure1)))
}

export function many1<I, O>(parser: Parser<I, O>): Parser<I, O[]> {
    return many1L(`ONE OR MANY ${parser.label}`, parser)
}

export function attemptL<I, O>(label: string, parser: Parser<I, O>) {
    Parser.create(label, (stream: Stream<I>) =>
        Result.match(parser.parse(stream),
            success => Parser.success(success.value, success.remaining),
            failure => Parser.refail(label, failure)))
}

export function attempt<I, O>(parser: Parser<I, O>) {
    return attemptL(`ATTEMPT ${parser.label}`, parser)
}

export function mapL<I, A, B>(label: string, parser: Parser<I, A>, mapper: Map<A, B>): Parser<I, B> {
    return Parser.create(label, (stream: Stream<I>) =>
        Result.match(parser.parse(stream),
            success => Parser.success(mapper(success.value), success.remaining),
            failure => Parser.refail(label, failure)))
}

export function map<I, A, B>(parser: Parser<I, A>, mapper: Map<A, B>): Parser<I, B> {
    return mapL(`MAP ${parser.label}`, parser, mapper)
}

export function labeled<I, O>(label: string, parser: Parser<I, O>): Parser<I, O> {
    return Parser.create(label, parser.parse)
}

// GENERIC PARSER CONSTRUCTORS

export function exactL<I>(label: string, value: I): Parser<I, I> {
    return Parser.create<I, I>(label, (stream: Stream<I>) =>
        Option.match(stream.tryTake(value),
            some => Parser.success(some[0], some[1]),
            none => Parser.failure(label, `Exact value not found`, stream)))
}

export function exact<I>(value: I): Parser<I, I> {
    return exactL(`EXACT ${value}`, value)
}

export function betweenL<I, A, B, C>(label: string, open: Parser<I, A>, close: Parser<I, B>, parser: Parser<I, C>) {
    return Parser.combine(open)
        .take(parser)
        .skip(close)
        .build(label)
}

export function between<I, A, B, C>(open: Parser<I, A>, close: Parser<I, B>, parser: Parser<I, C>) {
    return betweenL(`BETWEEN ${open.label} AND ${close.label} FIND ${parser.label}`, open, close, parser)
}

export function separatedL<I, A, B>(label: string, delimiter: Parser<I, A>, parser: Parser<I, B>) {
    return manyL(label, Parser.combine(parser)
        .skip(maybeL(label, delimiter))
        .build(label))
}

export function separated<I, A, B>(delimiter: Parser<I, A>, parser: Parser<I, B>) {
    return separatedL(`SEPARATED ${parser.label} WITH ${delimiter.label}`, delimiter, parser)
}

export function separated1L<I, A, B>(label: string, delimiter: Parser<I, A>, parser: Parser<I, B>) {
    return many1L(label, Parser.combine(parser)
        .skip(maybeL(label, delimiter))
        .build(label))
}

export function separated1<I, A, B>(delimiter: Parser<I, A>, parser: Parser<I, B>) {
    return separated1L(`ONE SEPARATED ${parser.label} WITH ${delimiter.label}`, delimiter, parser)
}

export function anyL<I, O>(label: string, ...parsers: Parser<I, O>[]): Parser<I, O> {
    return Parser.create(label,
        (stream: Stream<I>) => {
            for (let parser of parsers) {
                let result = parser.parse(stream)
                if (Result.isSuccess(result))
                    return result
            }
            return Parser.failure(label, "Any not found", stream)
        })
}

export function any<I, O>(...parsers: Parser<I, O>[]): Parser<I, O> {
    const label = parsers.map(p => p.label).join()
    return anyL(`ANY: ${label}`, ...parsers)
}

// HELPERS

export function flatten3<A, B, C>(value: [[A, B], C]): [A, B, C] {
    return [value[0][0], value[0][1], value[1]]
}

export function flatten4<A, B, C, D>(value: [[[A, B], C], D]): [A, B, C, D] {
    return [value[0][0][0], value[0][0][1], value[0][1], value[1]]
}

export function flatten5<A, B, C, D, E>(value: [[[[A, B], C], D], E]): [A, B, C, D, E] {
    return [value[0][0][0][0], value[0][0][0][1], value[0][0][1], value[0][1], value[1]]
}

export function flatten6<A, B, C, D, E, F>(value: [[[[[A, B], C], D], E], F]): [A, B, C, D, E, F] {
    return [value[0][0][0][0][0], value[0][0][0][0][1], value[0][0][0][1], value[0][0][1], value[0][1], value[1]]
}

export function flatten7<A, B, C, D, E, F, G>(value: [[[[[[A, B], C], D], E], F], G]): [A, B, C, D, E, F, G] {
    return [value[0][0][0][0][0][0], value[0][0][0][0][0][1], value[0][0][0][0][1], value[0][0][0][1], value[0][0][1], value[0][1], value[1]]
}

export function flatten8<A, B, C, D, E, F, G, H>(value: [[[[[[[A, B], C], D], E], F], G], H]): [A, B, C, D, E, F, G, H] {
    return [value[0][0][0][0][0][0][0], value[0][0][0][0][0][0][1], value[0][0][0][0][0][1], value[0][0][0][0][1], value[0][0][0][1], value[0][0][1], value[0][1], value[1]]
}

// DEBUG HELPERS

export function debug<I, O>(parser: Parser<I, O>, onSuccess: SuccessDebugger<I, O>, onFailure: FailureDebugger<I>): Parser<I, O> {
    return {
        label: "DEBUG",
        parse: (stream: Stream<I>) => {
            return Result.match(parser.parse(stream),
                success => {
                    onSuccess(success.value, success.remaining)
                    return Parser.success(success.value, success.remaining)
                },
                failure => {
                    onFailure(failure.error, failure.remaining)
                    return Parser.refail(parser.label, failure)
                })
        }
    }
}