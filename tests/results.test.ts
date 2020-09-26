import { Result } from "../src/results"
import { Parser } from "../src/parsers"
import { StringStream } from "../src/strings"

describe("result tests", () => {
    const stream = StringStream.create("")

    test("succeed with value", () => {
        let actual = Result.match(Parser.success("test", stream),
            success => success.value,
            failure => "fail")

        expect(actual).toBe("test")
    })

    test("succeed with undefined", () => {
        let actual = Result.match(Parser.success(undefined, stream),
            success => success.value,
            failure => "fail")

        expect(actual).toBeUndefined()
    })

    test("isSuccess with value", () => {
        let actual = Result.isSuccess(Parser.success("test", stream))

        expect(actual).toBe(true)
    })

    test("isSuccess with undefined", () => {
        let actual = Result.isSuccess(Parser.success(undefined, stream))

        expect(actual).toBe(true)
    })

    test("fail with error", () => {
        let actual = Result.match(Parser.failure("test", stream),
            success => success.value,
            failure => "pass")

        expect(actual).toBe("pass")
    })

    test("isfailure with error", () => {
        let actual = Result.isFailure(Parser.failure("test", stream))

        expect(actual).toBe(true)
    })
})
