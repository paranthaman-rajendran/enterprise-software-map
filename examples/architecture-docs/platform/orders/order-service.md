---
type: service
label: Order Service
owner: Orders
technology: Java 21
criticality: critical
calls:
  - "[[Payments API]]"
---

# Order Service

Owns the order lifecycle.

## Writes

- [[Orders DB]]

## Reads

- [[Catalog Service]]
