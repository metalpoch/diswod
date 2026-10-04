export function createRequestFreshness(initialContext = '') {
  let context = initialContext
  let generation = 0

  return {
    setContext(nextContext) {
      if (context === nextContext) return
      context = nextContext
      generation += 1
    },
    begin(requestContext = context) {
      if (requestContext !== context) return null
      generation += 1
      return { context, generation }
    },
    invalidate(requestContext = context) {
      if (requestContext !== context) return
      generation += 1
    },
    isCurrent(ticket) {
      return Boolean(ticket)
        && ticket.context === context
        && ticket.generation === generation
    },
  }
}

export function createSingleFlight() {
  let flight = null

  const run = (context, task) => {
    if (flight?.context === context) {
      flight.queued = true
      return flight.promise
    }

    const current = { context, task, queued: false, promise: null }
    flight = current
    current.promise = Promise.resolve()
      .then(task)
      .finally(() => {
        if (flight !== current) return
        flight = null
        if (current.queued) run(context, task).catch(() => {})
      })
    return current.promise
  }

  return {
    run,
    invalidate(context) {
      if (flight?.context !== context) return
      flight.queued = false
      flight = null
    },
  }
}
