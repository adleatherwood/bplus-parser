# BPLUS-PARSER

The bplus-parser library is a set of parsers and combinators inspired by the fparsec library.
The goal was to create an easy to use, TypeScript friendly version of those libraries.

## Example Usage

Here's a basic example setup to parse the name and parameters of some function.  This is a
basic example of the patterns that are used to build a parser.

```typescript
/* typescript */

// some structures to hold our parsed data in
type FunctionInfo = {
    name: string
    params: ParamInfo[]
}

type ParamInfo = {
    name: string
    type: string
}

// a function for creating space insensitive parsers
let syntax = (value: string) =>                                                |
    Parser.combine(many(space))
        .take(exact(value))                 // 'take' discards previous and keeps the current value
        .skip(many(space))                  // 'skip' parses but ignores values
        .build()                            // 'build' returns a single unified parser

// a parser for finding an unknown name
let id =
    Parser.combine(many1(char("ID", /[a-z]/)))
        .map(a => a.join(""))               // 'map' restructures parsed values
        .build("id")                        // 'build' takes a "label" for the parser

// a parser that returns a ParamInfo
let param =
    Parser.combine(id)
        .skip(syntax(":"))
        .and(id)                            // 'and' keeps previous values
        .map(args => {
            return {
                name: args[0],
                type: args[1]
            } as ParamInfo
        })
        .build()

// a parser that returns a FunctionInfo
let parser =
    Parser.combine(many(space))             // 'many' is a zero to (n) parser
        .skip(syntax("function"))
        .take(id)
        .skip(syntax("("))
        .and(separated(syntax(","), param))// 'separated' parses delimited values
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

// debugging parsers is sometimes challenging, printing the result can help
console.log(result)

// deconstructing the result
let value = Result.match(result,
    success => success.value,
    failure => { throw failure.error })

expect(value.name).toBe("create")
expect(value.params[0].name).toBe("name")
expect(value.params[0].type).toBe("string")
expect(value.params[1].name).toBe("value")
expect(value.params[1].type).toBe("int")
```

It's basically all about combining small parsers together to build bigger parsers.

## Parsers

In the following signatures, we'll assume that 'a', 'b', 'c', etc. are parsers.

### Value Parser Constructors

| Name | Signature | Function|
|------|-----------|---------|
| exact     | (a) => a     | Returns the exact value if matched
| between   | (a,o,c) => a | Returns the result of 'a' from in between 'o' and 'c'
| separated | (a, d) =>    | Returns an 'a' array that is delimited by 'd'

### Parser Modifiers

| Name | Signature | Function|
|------|-----------|---------|
| maybe   | (a) => a    | If the parser succeeds it returns the value, otherwise undefined
| many    | (a) => a[]  | Returns 0 to (n) values depending on many times the parser succeeds
| many1   | (a) => a[]  | Like 'many', but returns 1 to (n) values and fails if no values are found
| any     | (...a) => a | Returns the result of the first successful parser of the array
| attempt | (a) => a    | For ensuring you can walk back the stream index if the parser fails
| map     | (a) => b    | For transforming input to a different type
| labeled | (a) => a    | Adds a label to the current parser

### Parser Helpers (Mapping)

| Name | Signature | Function|
|------|-----------|---------|
| flatten3-8 | ((a,b),c) => [a,b,c] | Takes nested tuples and flattens them into a single tuple

### String Specific Parser Constructors

| Name | Signature | Function|
|------|-----------|---------|
| char | (ex) => c  | Like 'exact', but takes a regular expression for a single character

### Predefined String Parsers

| Name | Function|
|------|---------|
| space  | Matches a single space
| letter | Matches any letter
| digit  | Matches any digit
| number | Matches a number (e.g. "12", "1.2", "-12")

## The Parser Builder

The parser builder is intended to give you an intuitive way to combine smaller
parsers into larger parsers.  Here is a very simple example.

```typescript
let testParser: Parser<string,string[]> =
    Parser.combine(exact("this"))
        .skip(space)
        .and(exact("is"))
        .skip(space)
        .and(exact("a"))
        .skip(space)
        .and(exact("test"))
        // the result before 'flattening' is [[["this","is"],"a"],"test"]
        .map(flatten4)
        // the result after 'flattening' is ["this","is","a","test"]
        .build()
```

Here's a more complex example for the parsing of a number
with a line by line breakdown.

```typescript
const numberParser: Parser<string,number> =
    // Paser.combine() starts the builder workflow.  It takes a single parser.
    // Our first parser might return a "+" or a "-" or nothing as "-"
    Parser.combine(maybe(any(exact("+"), exact("-"))))
        // 'and' takes the previous sign and also returns 1 to (n) digits as ["-", [1,2,3]]
        .and(many1(digit))
        // this parser will return a decimal or undefined as [["-", [1,2,3]], "."]
        .and(maybe(exact(".")))
        // this parser will return 0 to (n) digits as [[["-", [1,2,3]], "."], [4,5,6]]
        .and(many(digit))
        // this helper will flatten out our nested tuples to ["-", [1,2,3], ".", [4,5,6]]
        .map(flatten4)
        // now we can easily put those parts together and return an actual number
        .map((a) => {
            const text = (a[0] || "") + (a[1].join("")) + (a[2] || "") + (a[3].join(""))
            return Number.parseFloat(text)
        })
        // build returns you a single parser for the parsers above
        .build()
```

The available builder functions are as follows:

| Name | Signature | Function|
|------|-----------|---------|
| and  | (a, b) => [a,b] | Takes two parsers and returns a tuple of their results
| take | (a, b) => b     | Discards and previously accumulated values and takes the value of 'b'
| skip | (a, b) => a     | Skips the value of 'b' and keeps the value of 'a'

Skip and take seem backwards, but in the context of a '.'-chained builder it fairly intuitive.

## Streams

Streams conform to a specific interface.

```typescript
export interface Stream<T> {
    tryTake(value: T): Option<[T, Stream<T>]>
    eof(): boolean
}
```

Below are the existing stream already defined in the library.

### String Stream

A general purpose stream for parsing strings.

```typescript
let stream - StringStream.create('this is a test')
```

A case insensitive stream can be created with the following.

```typescript
let stream - StringStream.create('this is a test', { caseInsensitive: true })
```