import { Result } from "bplus-composer"
import { ParseResult, exact, many, take, skip, separated, separated1, any } from "../src/parsers"
import { digit, number, StringStream } from "../src/strings"

describe("exact tests", () => {
    let stream = StringStream.create("this is a test")

    test("exact positive result", () => {
        let sut = exact("this")
        let actaul = Result.match(sut.parse(stream),
            success => success.value,
            failure => failure.error)

        expect(actaul).toBe("this")
    })

    test("exact negative result", () => {
        let sut = exact("that")
        let actual = Result.match(sut.parse(stream),
            success => success.value,
            failure => "fail")

        expect(actual).toBe("fail")
    })
})

describe("many tests", () => {
    test("many found result", () => {
        let stream = StringStream.create("aaa")
        let sut = many(exact("a"))

        let actual = Result.match(sut.parse(stream),
            success => success.value,
            failure => [])

        expect(actual.length).toBe(3)
        expect(actual[0]).toBe("a")
        expect(actual[1]).toBe("a")
        expect(actual[2]).toBe("a")
    })

    test("many not found result", () => {
        let stream = StringStream.create("bbb")
        let sut = many(exact("a"))

        let result = sut.parse(stream)
        let actual = Result.match(result,
            success => success.value,
            failure => [])

        expect(Result.isSuccess(result)).toBe(true)
        expect(actual.length).toBe(0)
    })
})

describe("take tests", () => {
    let stream = StringStream.create("abc")

    test("take takes second parser result", () => {
        let sut = take(exact("a"), exact("b"))
        let result = sut.parse(stream)
        let actual = Result.match(result,
            success => success.value,
            failure => "fail")

        expect(actual[0]).toBe("b")
        expect(ParseResult.remaining(result).value).toBe("c")
    })

    test("take failure", () => {
        let sut = take(exact("a"), exact("z"))
        let result = sut.parse(stream)
        let actual = Result.match(result,
            success => success.value,
            failure => "pass")

        expect(actual).toBe("pass")
        expect(ParseResult.remaining(result).value).toBe("bc")
    })
})

describe("skip tests", () => {
    let stream = StringStream.create("abc")

    test("skip takes first parser result", () => {
        let sut = skip(exact("a"), exact("b"))
        let result = sut.parse(stream)
        let actual = Result.match(result,
            success => success.value,
            failure => "fail")

        expect(actual).toBe("a")
        expect(ParseResult.remaining(result).value).toBe("c")
    })

    test("skip failure", () => {
        let sut = skip(exact("a"), exact("z"))
        let result = sut.parse(stream)
        let actual = Result.match(result,
            success => success.value,
            failure => "pass")

        expect(actual).toBe("pass")
        expect(ParseResult.remaining(result).value).toBe("bc")
    })
})

describe("separated tests", () => {

    test("separated example usage test", () => {
        let stream = StringStream.create("1,2,3")
        let sut = separated(exact(","), digit)
        let result = sut.parse(stream)
        let actual = Result.match(result,
            success => success.value,
            failure => [])

        expect(actual.length).toBe(3)
        expect(actual[0]).toBe("1")
        expect(actual[1]).toBe("2")
        expect(actual[2]).toBe("3")
    })

    test("separated zero found test", () => {
        let stream = StringStream.create("")
        let sut = separated(exact(","), digit)
        let result = sut.parse(stream)
        let passed = Result.match(result,
            success => true,
            failure => false)
        let actual = Result.match(result,
            success => success.value,
            failure => [])

        expect(passed).toBe(true)
        expect(actual.length).toBe(0)
    })

    test("separated one found test", () => {
        let stream = StringStream.create("1")
        let sut = separated1(exact(","), digit)
        let result = sut.parse(stream)
        let passed = Result.match(result,
            success => true,
            failure => false)
        let actual = Result.match(result,
            success => success.value,
            failure => [])

        expect(passed).toBe(true)
        expect(actual.length).toBe(1)
        expect(actual[0]).toBe("1")
    })
})

describe("separated1 tests", () => {

    test("separated1 example usage test", () => {
        let stream = StringStream.create("1,2,3")
        let sut = separated1(exact(","), digit)
        let result = sut.parse(stream)
        let actual = Result.match(result,
            success => success.value,
            failure => [])

        expect(actual.length).toBe(3)
        expect(actual[0]).toBe("1")
        expect(actual[1]).toBe("2")
        expect(actual[2]).toBe("3")
    })

    test("separated1 zero found test", () => {
        let stream = StringStream.create("")
        let sut = separated1(exact(","), digit)
        let result = sut.parse(stream)
        let passed = Result.match(result,
            success => true,
            failure => false)
        let actual = Result.match(result,
            success => success.value,
            failure => [])

        expect(passed).toBe(false)
        expect(actual.length).toBe(0)
    })

    test("separated1 one found test", () => {
        let stream = StringStream.create("1")
        let sut = separated1(exact(","), digit)
        let result = sut.parse(stream)
        let passed = Result.match(result,
            success => true,
            failure => false)
        let actual = Result.match(result,
            success => success.value,
            failure => [])

        expect(passed).toBe(true)
        expect(actual.length).toBe(1)
        expect(actual[0]).toBe("1")
    })
})

describe("any tests", () => {
    const sut = any(exact("A"), exact("B"), exact("C"))

    test("any basic usage A", () => {
        let stream = StringStream.create("A")
        let actual = Result.match(sut.parse(stream),
            success => success.value,
            failure => "")
        expect(actual).toBe("A")
    })

    test("any basic usage B", () => {
        let stream = StringStream.create("B")
        let actual = Result.match(sut.parse(stream),
            success => success.value,
            failure => "")
        expect(actual).toBe("B")
    })

    test("any basic usage C", () => {
        let stream = StringStream.create("C")
        let actual = Result.match(sut.parse(stream),
            success => success.value,
            failure => "")
        expect(actual).toBe("C")
    })
})

describe("number parser tests", () => {

    test("number parser basic test", () => {
        const exampleA = StringStream.create("12.3")

        let result = number.parse(exampleA)
        let actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))
        expect(actual).toBe(12.3)
    })

    test("number parser positive test", () => {
        const exampleA = StringStream.create("+12.3")

        let result = number.parse(exampleA)
        let actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))
        expect(actual).toBe(12.3)
    })

    test("number parser negative test", () => {
        const exampleA = StringStream.create("-12.3")

        let result = number.parse(exampleA)
        let actual = Result.match(result,
            success => success.value,
            failure => fail(failure.error))
        expect(actual).toBe(-12.3)
    })
})