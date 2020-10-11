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

export module Parser {

    export function create<I, O>(label: string, parser: (s: Stream<I>) => ParseResult<I, O>): Parser<I, O> {
        return {
            label: label,
            parse: (stream: Stream<I>) => {
                if (stream.eof())
                    return failure("EOF", stream)
                else
                    return parser(stream)
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

    export function failure<I, O>(failure: string, remaining: Stream<I>): ParseResult<I, O> {
        let f: Failed<I> = {
            error: failure,
            remaining: remaining
        }
        return Result.failure(f)
    }

    export function refail<I, O>(f: Failed<I>): ParseResult<I, O> {
        return failure(f.error, f.remaining)
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

export function and<I, A, B>(parserA: Parser<I, A>, parserB: Parser<I, B>): Parser<I, [A, B]> {
    return {
        label: `${parserA.label} AND ${parserB.label}`,
        parse: (stream: Stream<I>) =>
            Result.match(parserA.parse(stream),
                success1 => Result.match(parserB.parse(success1.remaining),
                    success2 => Parser.success([success1.value, success2.value], success2.remaining),
                    failure2 => Parser.refail(failure2)),
                failure1 => Parser.refail(failure1))
    }
}

export function skip<I, A, B>(parserA: Parser<I, A>, parserB: Parser<I, B>): Parser<I, A> {
    return {
        label: parserA.label,
        parse: (stream: Stream<I>) =>
            Result.match(parserA.parse(stream),
                success1 => Result.match(parserB.parse(success1.remaining),
                    success2 => Parser.success(success1.value, success2.remaining),
                    failure2 => Parser.refail(failure2)),
                failure1 => Parser.refail(failure1))
    }
}

export function take<I, A, B>(parserA: Parser<I, A>, parserB: Parser<I, B>): Parser<I, B> {
    return {
        label: parserB.label,
        parse: (stream: Stream<I>) =>
            Result.match(parserA.parse(stream),
                success => parserB.parse(success.remaining),
                failure => Parser.refail(failure))
    }
}

// GENERIC PARSER MODIFIERS

export function maybeL<I, O>(label: string, parser: Parser<I, O>): Parser<I, O> {
    return {
        label: label,
        parse: (stream: Stream<I>) =>
            Result.match(parser.parse(stream),
                success => Parser.success(success.value, success.remaining),
                failure => Parser.success<I, O>(undefined, failure.remaining))
    }
}

export function maybe<I, O>(parser: Parser<I, O>): Parser<I, O> {
    return maybeL("MAYBE", parser)
}

export function manyL<I, O>(label: string, parser: Parser<I, O>): Parser<I, O[]> {
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
    return manyL("ZERO OR MANY", parser)
}

export function many1L<I, O>(label: string, parser: Parser<I, O>): Parser<I, O[]> {
    return {
        label: label,
        parse: (stream: Stream<I>) =>
            Result.match(parser.parse(stream),
                success1 => Result.match(many(parser).parse(success1.remaining),
                    success2 => Parser.success([success1.value].concat(success2.value), success2.remaining),
                    failure2 => Parser.refail(failure2)),
                failure1 => Parser.refail(failure1))
    }
}

export function many1<I, O>(parser: Parser<I, O>): Parser<I, O[]> {
    return many1L("ONE OR MANY", parser)
}

export function attemptL<I, O>(label: string, parser: Parser<I, O>) {
    return {
        label: label,
        parse: (stream: Stream<I>) =>
            Result.match(parser.parse(stream),
                success => Parser.success(success.value, success.remaining),
                failure => Parser.refail(failure))
    }
}

export function attempt<I, O>(parser: Parser<I, O>) {
    return attemptL("ATEMPT", parser)
}

export function mapL<I, A, B>(label: string, parser: Parser<I, A>, mapper: Map<A, B>): Parser<I, B> {
    return {
        label: label,
        parse: (stream: Stream<I>) =>
            Result.match(parser.parse(stream),
                success => Parser.success(mapper(success.value), success.remaining),
                failure => Parser.refail(failure))
    }
}

export function map<I, A, B>(parser: Parser<I, A>, mapper: Map<A, B>): Parser<I, B> {
    return mapL("MAP", parser, mapper)
}

export function labeled<I, O>(label: string, parser: Parser<I, O>): Parser<I, O> {
    return Parser.create(label, parser.parse)
}

// GENERIC PARSER CONSTRUCTORS

export function exactL<I>(label: string, value: I): Parser<I, I> {
    return Parser.create<I, I>(label, (stream: Stream<I>) =>
        Option.match(stream.tryTake(value),
            some => Parser.success(some[0], some[1]),
            none => Parser.failure(`Exact value not found`, stream)))
}

export function exact<I>(value: I): Parser<I, I> {
    return exactL("EXACT", value)
}

export function betweenL<I, A, B, C>(label: string, open: Parser<I, A>, close: Parser<I, B>, parser: Parser<I, C>) {
    return Parser.combine(open)
        .take(parser)
        .skip(close)
        .build(label)
}

export function between<I, A, B, C>(open: Parser<I, A>, close: Parser<I, B>, parser: Parser<I, C>) {
    return betweenL("BETWEEN", open, close, parser)
}

export function separatedL<I, A, B>(label: string, delimiter: Parser<I, A>, parser: Parser<I, B>) {
    return manyL(label, Parser.combine(parser)
        .skip(maybeL(label, delimiter))
        .build())
}

export function separated<I, A, B>(delimiter: Parser<I, A>, parser: Parser<I, B>) {
    return separatedL("SEPARATED", delimiter, parser)
}

export function separated1L<I, A, B>(label: string, delimiter: Parser<I, A>, parser: Parser<I, B>) {
    return many1L(label, Parser.combine(parser)
        .skip(maybeL(label, delimiter))
        .build())
}

export function separated1<I, A, B>(delimiter: Parser<I, A>, parser: Parser<I, B>) {
    return separated1L("SEPARATED", delimiter, parser)
}

export function anyL<I, O>(label: string, ...parsers: Parser<I, O>[]): Parser<I, O> {
    return Parser.create(label,
        (stream: Stream<I>) => {
            for (let parser of parsers) {
                let result = parser.parse(stream)
                if (Result.isSuccess(result))
                    return result
            }
            return Parser.failure("Any not found", stream)
        })
}

export function any<I, O>(...parsers: Parser<I, O>[]): Parser<I, O> {
    return anyL("ANY", ...parsers)
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