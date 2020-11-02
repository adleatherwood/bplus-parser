import { Result } from "bplus-composer"
import { Parser, many1, exact, many, flatten4, separated } from "../src/parsers"
import { StringStream, space, char } from "../src/strings"

describe("basic tests", () => {
    test("example test", () => {

        type FunctionInfo = {
            name: string
            params: ParamInfo[]
        }

        type ParamInfo = {
            name: string
            type: string
        }

        // a function for creating space insensitive parsers
        let syntax = (value: string) =>
            Parser.combine(many(space))
                .take(exact(value))
                .skip(many(space))
                .build()

        // a parser for finding an unknown name
        let id =
            Parser.combine(many1(char("ID", /[a-z]/)))
                .map(a => a.join(""))
                .build("id")

        // a parser that returns a ParamInfo
        let param =
            Parser.combine(id)
                .skip(syntax(":"))
                .and(id)
                .map(args => {
                    return {
                        name: args[0],
                        type: args[1]
                    } as ParamInfo
                })
                .build()

        // a parser that returns a FunctionInfo
        let parser =
            Parser.combine(many(space))
                .skip(syntax("function"))
                .take(id)
                .skip(syntax("("))
                .and(separated(syntax(","), param))
                .map(args => {
                    return {
                        name: args[0],
                        params: args[1]
                    } as FunctionInfo
                })
                .build()

        // a "stream" of input to be parsed
        let stream = StringStream.create(`
        function create(name: string, value: int) {
            ...
        }`)

        // parsing the stream
        let result = parser.parse(stream)

        // debugging parsers is challenging, printing the result out helps
        //console.log(result)

        // deconstructing the result
        let value = Result.match(result,
            success => success.value,
            failure => { throw failure.error })

        expect(value.name).toBe("create")
        expect(value.params[0].name).toBe("name")
        expect(value.params[0].type).toBe("string")
        expect(value.params[1].name).toBe("value")
        expect(value.params[1].type).toBe("int")
    })

    test("case sensitive test", () => {
        let stream = StringStream.create("this is a test")
        let parser = Parser.combine(exact("this"))
            .skip(many1(space))
            .and(exact("is"))
            .skip(many1(space))
            .and(exact("a"))
            .skip(many1(space))
            .and(exact("test"))
            .map(flatten4)
            .build()
        let result = parser.parse(stream)
        let value = Result.match(result,
            success => success.value,
            failure => { throw failure.error })

        expect(value[0]).toBe("this")
        expect(value[1]).toBe("is")
        expect(value[2]).toBe("a")
        expect(value[3]).toBe("test")
    })

    test("case insensitive test", () => {
        let stream = StringStream.create("this is a test", { caseInsensitive: true })
        let sut = Parser.combine(exact("THIS"))
            .skip(many1(space))
            .and(exact("IS"))
            .skip(many1(space))
            .and(exact("A"))
            .skip(many1(space))
            .and(exact("TEST"))
            .build()
        let result = sut.parse(stream)

        expect(Result.isSuccess(result)).toBe(true)
    })

    test("completely insensitive test", () => {

        function syn(value: string) {
            return Parser.combine(many(space))
                .take(exact(value))
                .build(value)
        }

        let stream = StringStream.create("This Is  A   Test", { caseInsensitive: true })
        let sut = Parser.combine(syn("this"))
            .and(syn("is"))
            .and(syn("a"))
            .and(syn("test"))
            .build()
        let result = sut.parse(stream)

        expect(Result.isSuccess(result)).toBe(true)
    })
})