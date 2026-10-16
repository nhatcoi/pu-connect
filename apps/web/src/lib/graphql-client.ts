const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || '/graphql'

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string; locations?: unknown[]; path?: string[] }>
}

export async function graphqlClient<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    credentials: 'include', // Automatically send pu_session cookie
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      query,
      variables
    })
  })

  if (!response.ok) {
    throw new Error(`GraphQL Network Error: ${response.statusText}`)
  }

  const result: GraphQLResponse<T> = await response.json()

  if (result.errors && result.errors.length > 0) {
    const errorMsg = result.errors.map((e) => e.message).join(', ')
    throw new Error(errorMsg)
  }

  if (!result.data) {
    throw new Error('GraphQL returned no data')
  }

  return result.data
}
