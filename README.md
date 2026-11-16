````
you can create inngest files anywhere but the most important part is:

```ts
app.use(
    <!-- Expose the middleware on our recommended path at '/api/inngest' -->
    "/api/inngest",
    serve({
        client: inngest,
        function:
        /* functions */
    })
)
````
