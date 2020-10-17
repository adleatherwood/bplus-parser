import { Result } from "bplus-composer"
import { exact, many, separated } from "../src/parsers"
import { IterableStream } from "../src/streams"
import { letter, StringsStream } from "../src/strings"

describe("StringsStream tests", () => {

    test("Basic usage test", () => {
        let stream = StringsStream.create(["a", "b", "c"])
        let parser = many(letter)
        let actual = Result.match(parser.parse(stream),
            success => success.value.join(),
            failure => fail("Unexpected error"))

        expect(actual).toBe("a,b,c")
    })
})

describe("IterableStream tests", () => {

    test("IterableStream basic usage", () => {
        let comparer = (a: number, b: number) => a === b ? 0 : -1
        let stream = IterableStream.create([1, 0, 1, 0, 1], comparer)
        let parser = separated(exact(0), exact(1))
        let actual = Result.match(parser.parse(stream),
            success => success.value.join(),
            failure => fail(failure.error))

        expect(actual).toBe("1,1,1")
    })
})