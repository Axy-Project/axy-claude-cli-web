import type { CatalogSkill } from './skill-catalog.js'

export const javaSkillCatalog: CatalogSkill[] = [
  {
    id: 'java-api-contract-review',
    name: 'api-contract-review',
    description: 'Review REST API contracts for HTTP semantics, versioning, backward compatibility, and response consistency.',
    category: 'java',
    trigger: '/java-api',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# API Contract Review Skill

Audit REST API design for correctness, consistency, and compatibility.

## When to Use
- User asks "review this API" / "check REST endpoints"
- Before releasing API changes
- Reviewing PR with controller changes
- Checking backward compatibility

---

## Quick Reference: Common Issues

| Issue | Symptom | Impact |
|-------|---------|--------|
| Wrong HTTP verb | POST for idempotent operation | Confusion, caching issues |
| Missing versioning | \`/users\` instead of \`/v1/users\` | Breaking changes affect all clients |
| Entity leak | JPA entity in response | Exposes internals, N+1 risk |
| 200 with error | \`{"status": 200, "error": "..."}\` | Breaks error handling |
| Inconsistent naming | \`/getUsers\` vs \`/users\` | Hard to learn API |

---

## HTTP Verb Semantics

### Verb Selection Guide

| Verb | Use For | Idempotent | Safe | Request Body |
|------|---------|------------|------|--------------|
| GET | Retrieve resource | Yes | Yes | No |
| POST | Create new resource | No | No | Yes |
| PUT | Replace entire resource | Yes | No | Yes |
| PATCH | Partial update | No* | No | Yes |
| DELETE | Remove resource | Yes | No | Optional |

*PATCH can be idempotent depending on implementation

### Common Mistakes

\`\`\`java
// ❌ POST for retrieval
@PostMapping("/users/search")
public List<User> searchUsers(@RequestBody SearchCriteria criteria) { }

// ✅ GET with query params (or POST only if criteria is very complex)
@GetMapping("/users")
public List<User> searchUsers(
    @RequestParam String name,
    @RequestParam(required = false) String email) { }

// ❌ GET for state change
@GetMapping("/users/{id}/activate")
public void activateUser(@PathVariable Long id) { }

// ✅ POST or PATCH for state change
@PostMapping("/users/{id}/activate")
public ResponseEntity<Void> activateUser(@PathVariable Long id) { }

// ❌ POST for idempotent update
@PostMapping("/users/{id}")
public User updateUser(@PathVariable Long id, @RequestBody UserDto dto) { }

// ✅ PUT for full replacement, PATCH for partial
@PutMapping("/users/{id}")
public User replaceUser(@PathVariable Long id, @RequestBody UserDto dto) { }

@PatchMapping("/users/{id}")
public User updateUser(@PathVariable Long id, @RequestBody UserPatchDto dto) { }
\`\`\`

---

## API Versioning

### Strategies

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| URL path | \`/v1/users\` | Clear, easy routing | URL changes |
| Header | \`Accept: application/vnd.api.v1+json\` | Clean URLs | Hidden, harder to test |
| Query param | \`/users?version=1\` | Easy to add | Easy to forget |

### Recommended: URL Path

\`\`\`java
// ✅ Versioned endpoints
@RestController
@RequestMapping("/api/v1/users")
public class UserControllerV1 { }

@RestController
@RequestMapping("/api/v2/users")
public class UserControllerV2 { }

// ❌ No versioning
@RestController
@RequestMapping("/api/users")  // Breaking changes affect everyone
public class UserController { }
\`\`\`

### Version Checklist
- [ ] All public APIs have version in path
- [ ] Internal APIs documented as internal (or versioned too)
- [ ] Deprecation strategy defined for old versions

---

## Request/Response Design

### DTO vs Entity

\`\`\`java
// ❌ Entity in response (leaks internals)
@GetMapping("/{id}")
public User getUser(@PathVariable Long id) {
    return userRepository.findById(id).orElseThrow();
    // Exposes: password hash, internal IDs, lazy collections
}

// ✅ DTO response
@GetMapping("/{id}")
public UserResponse getUser(@PathVariable Long id) {
    User user = userService.findById(id);
    return UserResponse.from(user);  // Only public fields
}
\`\`\`

### Response Consistency

\`\`\`java
// ❌ Inconsistent responses
@GetMapping("/users")
public List<User> getUsers() { }  // Returns array

@GetMapping("/users/{id}")
public User getUser(@PathVariable Long id) { }  // Returns object

@GetMapping("/users/count")
public int countUsers() { }  // Returns primitive

// ✅ Consistent wrapper (optional but recommended for large APIs)
@GetMapping("/users")
public ApiResponse<List<UserResponse>> getUsers() {
    return ApiResponse.success(userService.findAll());
}

// Or at minimum, consistent structure:
// - Collections: always wrapped or always raw (pick one)
// - Single items: always object
// - Counts/stats: always object { "count": 42 }
\`\`\`

### Pagination

\`\`\`java
// ❌ No pagination on collections
@GetMapping("/users")
public List<User> getAllUsers() {
    return userRepository.findAll();  // Could be millions
}

// ✅ Paginated
@GetMapping("/users")
public Page<UserResponse> getUsers(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size) {
    return userService.findAll(PageRequest.of(page, size));
}
\`\`\`

---

## HTTP Status Codes

### Success Codes

| Code | When to Use | Response Body |
|------|-------------|---------------|
| 200 OK | Successful GET, PUT, PATCH | Resource or result |
| 201 Created | Successful POST (created) | Created resource + Location header |
| 204 No Content | Successful DELETE, or PUT with no body | Empty |

### Error Codes

| Code | When to Use | Common Mistake |
|------|-------------|----------------|
| 400 Bad Request | Invalid input, validation failed | Using for "not found" |
| 401 Unauthorized | Not authenticated | Confusing with 403 |
| 403 Forbidden | Authenticated but not allowed | Using 401 instead |
| 404 Not Found | Resource doesn't exist | Using 400 |
| 409 Conflict | Duplicate, concurrent modification | Using 400 |
| 422 Unprocessable | Semantic error (valid syntax, invalid meaning) | Using 400 |
| 500 Internal Error | Unexpected server error | Exposing stack traces |

### Anti-Pattern: 200 with Error Body

\`\`\`java
// ❌ NEVER DO THIS
@GetMapping("/{id}")
public ResponseEntity<Map<String, Object>> getUser(@PathVariable Long id) {
    try {
        User user = userService.findById(id);
        return ResponseEntity.ok(Map.of("status", "success", "data", user));
    } catch (NotFoundException e) {
        return ResponseEntity.ok(Map.of(  // Still 200!
            "status", "error",
            "message", "User not found"
        ));
    }
}

// ✅ Use proper status codes
@GetMapping("/{id}")
public ResponseEntity<UserResponse> getUser(@PathVariable Long id) {
    return userService.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
}
\`\`\`

---

## Error Response Format

### Consistent Error Structure

\`\`\`java
// ✅ Standard error response
public class ErrorResponse {
    private String code;        // Machine-readable: "USER_NOT_FOUND"
    private String message;     // Human-readable: "User with ID 123 not found"
    private Instant timestamp;
    private String path;
    private List<FieldError> errors;  // For validation errors
}

// In GlobalExceptionHandler
@ExceptionHandler(ResourceNotFoundException.class)
public ResponseEntity<ErrorResponse> handleNotFound(
        ResourceNotFoundException ex, HttpServletRequest request) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(ErrorResponse.builder()
            .code("RESOURCE_NOT_FOUND")
            .message(ex.getMessage())
            .timestamp(Instant.now())
            .path(request.getRequestURI())
            .build());
}
\`\`\`

### Security: Don't Expose Internals

\`\`\`java
// ❌ Exposes stack trace
@ExceptionHandler(Exception.class)
public ResponseEntity<String> handleAll(Exception ex) {
    return ResponseEntity.status(500)
        .body(ex.getStackTrace().toString());  // Security risk!
}

// ✅ Generic message, log details server-side
@ExceptionHandler(Exception.class)
public ResponseEntity<ErrorResponse> handleAll(Exception ex) {
    log.error("Unexpected error", ex);  // Full details in logs
    return ResponseEntity.status(500)
        .body(ErrorResponse.of("INTERNAL_ERROR", "An unexpected error occurred"));
}
\`\`\`

---

## Backward Compatibility

### Breaking Changes (Avoid in Same Version)

| Change | Breaking? | Migration |
|--------|-----------|-----------|
| Remove endpoint | Yes | Deprecate first, remove in next version |
| Remove field from response | Yes | Keep field, return null/default |
| Add required field to request | Yes | Make optional with default |
| Change field type | Yes | Add new field, deprecate old |
| Rename field | Yes | Support both temporarily |
| Change URL path | Yes | Redirect old to new |

### Non-Breaking Changes (Safe)

- Add optional field to request
- Add field to response
- Add new endpoint
- Add new optional query parameter

### Deprecation Pattern

\`\`\`java
@RestController
@RequestMapping("/api/v1/users")
public class UserControllerV1 {

    @Deprecated
    @GetMapping("/by-email")  // Old endpoint
    public UserResponse getByEmailOld(@RequestParam String email) {
        return getByEmail(email);  // Delegate to new
    }

    @GetMapping(params = "email")  // New pattern
    public UserResponse getByEmail(@RequestParam String email) {
        return userService.findByEmail(email);
    }
}
\`\`\`

---

## API Review Checklist

### 1. HTTP Semantics
- [ ] GET for retrieval only (no side effects)
- [ ] POST for creation (returns 201 + Location)
- [ ] PUT for full replacement (idempotent)
- [ ] PATCH for partial updates
- [ ] DELETE for removal (idempotent)

### 2. URL Design
- [ ] Versioned (\`/v1/\`, \`/v2/\`)
- [ ] Nouns, not verbs (\`/users\`, not \`/getUsers\`)
- [ ] Plural for collections (\`/users\`, not \`/user\`)
- [ ] Hierarchical for relationships (\`/users/{id}/orders\`)
- [ ] Consistent naming (kebab-case or camelCase, pick one)

### 3. Request Handling
- [ ] Validation with \`@Valid\`
- [ ] Clear error messages for validation failures
- [ ] Request DTOs (not entities)
- [ ] Reasonable size limits

### 4. Response Design
- [ ] Response DTOs (not entities)
- [ ] Consistent structure across endpoints
- [ ] Pagination for collections
- [ ] Proper status codes (not 200 for errors)

### 5. Error Handling
- [ ] Consistent error format
- [ ] Machine-readable error codes
- [ ] Human-readable messages
- [ ] No stack traces exposed
- [ ] Proper 4xx vs 5xx distinction

### 6. Compatibility
- [ ] No breaking changes in current version
- [ ] Deprecated endpoints documented
- [ ] Migration path for breaking changes

---

## Token Optimization

For large APIs:
1. List all controllers: \`find . -name "*Controller.java"\`
2. Sample 2-3 controllers for pattern analysis
3. Check \`@ExceptionHandler\` configuration once
4. Grep for specific anti-patterns:
   \`\`\`bash
   # Find potential entity leaks
   grep -r "public.*Entity.*@GetMapping" --include="*.java"

   # Find 200 with error patterns
   grep -r "ResponseEntity.ok.*error" --include="*.java"

   # Find unversioned APIs
   grep -r "@RequestMapping.*api" --include="*.java" | grep -v "/v[0-9]"
   \`\`\``,
  },
  {
    id: 'java-architecture-review',
    name: 'architecture-review',
    description: 'Analyze Java project architecture - package structure, module boundaries, dependency direction, and layering.',
    category: 'java',
    trigger: '/java-arch',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# Architecture Review Skill

Analyze project structure at the macro level - packages, modules, layers, and boundaries.

## When to Use
- User asks "review the architecture" / "check project structure"
- Evaluating package organization
- Checking dependency direction between layers
- Identifying architectural violations
- Assessing clean/hexagonal architecture compliance

---

## Quick Reference: Architecture Smells

| Smell | Symptom | Impact |
|-------|---------|--------|
| Package-by-layer bloat | \`service/\` with 50+ classes | Hard to find related code |
| Domain → Infra dependency | Entity imports \`@Repository\` | Core logic tied to framework |
| Circular dependencies | A → B → C → A | Untestable, fragile |
| God package | \`util/\` or \`common/\` growing | Dump for misplaced code |
| Leaky abstractions | Controller knows SQL | Layer boundaries violated |

---

## Package Organization Strategies

### Package-by-Layer (Traditional)

\`\`\`
com.example.app/
├── controller/
│   ├── UserController.java
│   ├── OrderController.java
│   └── ProductController.java
├── service/
│   ├── UserService.java
│   ├── OrderService.java
│   └── ProductService.java
├── repository/
│   ├── UserRepository.java
│   ├── OrderRepository.java
│   └── ProductRepository.java
└── model/
    ├── User.java
    ├── Order.java
    └── Product.java
\`\`\`

**Pros**: Familiar, simple for small projects
**Cons**: Scatters related code, doesn't scale, hard to extract modules

### Package-by-Feature (Recommended)

\`\`\`
com.example.app/
├── user/
│   ├── UserController.java
│   ├── UserService.java
│   ├── UserRepository.java
│   └── User.java
├── order/
│   ├── OrderController.java
│   ├── OrderService.java
│   ├── OrderRepository.java
│   └── Order.java
└── product/
    ├── ProductController.java
    ├── ProductService.java
    ├── ProductRepository.java
    └── Product.java
\`\`\`

**Pros**: Related code together, easy to extract, clear boundaries
**Cons**: May need shared kernel for cross-cutting concerns

### Hexagonal/Clean Architecture

\`\`\`
com.example.app/
├── domain/                    # Pure business logic (no framework imports)
│   ├── model/
│   │   └── User.java
│   ├── port/
│   │   ├── in/               # Use cases (driven)
│   │   │   └── CreateUserUseCase.java
│   │   └── out/              # Repositories (driving)
│   │       └── UserRepository.java
│   └── service/
│       └── UserDomainService.java
├── application/               # Use case implementations
│   └── CreateUserService.java
├── adapter/
│   ├── in/
│   │   └── web/
│   │       └── UserController.java
│   └── out/
│       └── persistence/
│           ├── UserJpaRepository.java
│           └── UserEntity.java
└── config/
    └── BeanConfiguration.java
\`\`\`

**Key rule**: Dependencies point inward (adapters → application → domain)

---

## Dependency Direction Rules

### The Golden Rule

\`\`\`
┌─────────────────────────────────────────┐
│              Frameworks                 │  ← Outer (volatile)
├─────────────────────────────────────────┤
│           Adapters (Web, DB)            │
├─────────────────────────────────────────┤
│         Application Services            │
├─────────────────────────────────────────┤
│          Domain (Core Logic)            │  ← Inner (stable)
└─────────────────────────────────────────┘

Dependencies MUST point inward only.
Inner layers MUST NOT know about outer layers.
\`\`\`

### Violations to Flag

\`\`\`java
// ❌ Domain depends on infrastructure
package com.example.domain.model;

import org.springframework.data.jpa.repository.JpaRepository;  // Framework leak!
import javax.persistence.Entity;  // JPA in domain!

@Entity
public class User {
    // Domain polluted with persistence concerns
}

// ❌ Domain depends on adapter
package com.example.domain.service;

import com.example.adapter.out.persistence.UserJpaRepository;  // Wrong direction!

// ✅ Domain defines port, adapter implements
package com.example.domain.port.out;

public interface UserRepository {  // Pure interface, no JPA
    User findById(UserId id);
    void save(User user);
}
\`\`\`

---

## Architecture Review Checklist

### 1. Package Structure
- [ ] Clear organization strategy (by-layer, by-feature, or hexagonal)
- [ ] Consistent naming across modules
- [ ] No \`util/\` or \`common/\` packages growing unbounded
- [ ] Feature packages are cohesive (related code together)

### 2. Dependency Direction
- [ ] Domain has ZERO framework imports (Spring, JPA, Jackson)
- [ ] Adapters depend on domain, not vice versa
- [ ] No circular dependencies between packages
- [ ] Clear dependency hierarchy

### 3. Layer Boundaries
- [ ] Controllers don't contain business logic
- [ ] Services don't know about HTTP (no HttpServletRequest)
- [ ] Repositories don't leak into controllers
- [ ] DTOs at boundaries, domain objects inside

### 4. Module Boundaries
- [ ] Each module has clear public API
- [ ] Internal classes are package-private
- [ ] Cross-module communication through interfaces
- [ ] No "reaching across" modules for internals

### 5. Scalability Indicators
- [ ] Could extract a feature to separate service? (microservice-ready)
- [ ] Are boundaries enforced or just conventional?
- [ ] Does adding a feature require touching many packages?

---

## Common Anti-Patterns

### 1. The Big Ball of Mud

\`\`\`
src/main/java/com/example/
└── app/
    ├── User.java
    ├── UserController.java
    ├── UserService.java
    ├── UserRepository.java
    ├── Order.java
    ├── OrderController.java
    ├── ... (100+ files in one package)
\`\`\`

**Fix**: Introduce package structure (start with by-feature)

### 2. The Util Dumping Ground

\`\`\`
util/
├── StringUtils.java
├── DateUtils.java
├── ValidationUtils.java
├── SecurityUtils.java
├── EmailUtils.java      # Should be in notification module
├── OrderCalculator.java # Should be in order domain
└── UserHelper.java      # Should be in user domain
\`\`\`

**Fix**: Move domain logic to appropriate modules, keep only truly generic utils

### 3. Anemic Domain Model

\`\`\`java
// Domain object is just data
public class Order {
    private Long id;
    private List<OrderLine> lines;
    private BigDecimal total;
    // Only getters/setters, no behavior
}

// All logic in "service"
public class OrderService {
    public void addLine(Order order, Product product, int qty) { ... }
    public void calculateTotal(Order order) { ... }
    public void applyDiscount(Order order, Discount discount) { ... }
}
\`\`\`

**Fix**: Move behavior to domain objects (rich domain model)

### 4. Framework Coupling in Domain

\`\`\`java
package com.example.domain;

@Entity  // JPA
@Data    // Lombok
@JsonIgnoreProperties(ignoreUnknown = true)  // Jackson
public class User {
    @Id @GeneratedValue
    private Long id;

    @NotBlank  // Validation
    private String email;
}
\`\`\`

**Fix**: Separate domain model from persistence/API models

---

## Analysis Commands

When reviewing architecture, examine:

\`\`\`bash
# Package structure overview
find src/main/java -type d | head -30

# Largest packages (potential god packages)
find src/main/java -name "*.java" | xargs dirname | sort | uniq -c | sort -rn | head -10

# Check for framework imports in domain
grep -r "import org.springframework" src/main/java/*/domain/ 2>/dev/null
grep -r "import javax.persistence" src/main/java/*/domain/ 2>/dev/null

# Find circular dependencies (look for bidirectional imports)
# Check if package A imports from B and B imports from A
\`\`\`

---

## Recommendations Format

When reporting findings:

\`\`\`markdown
## Architecture Review: [Project Name]

### Structure Assessment
- **Organization**: Package-by-layer / Package-by-feature / Hexagonal
- **Clarity**: Clear / Mixed / Unclear

### Findings

| Severity | Issue | Location | Recommendation |
|----------|-------|----------|----------------|
| High | Domain imports Spring | \`domain/model/User.java\` | Extract pure domain model |
| Medium | God package | \`util/\` (23 classes) | Distribute to feature modules |
| Low | Inconsistent naming | \`service/\` vs \`services/\` | Standardize to \`service/\` |

### Dependency Analysis
[Describe dependency flow, violations found]

### Recommendations
1. [Highest priority fix]
2. [Second priority]
3. [Nice to have]
\`\`\`

---

## Token Optimization

For large codebases:
1. Start with \`find\` to understand structure
2. Check only domain package for framework imports
3. Sample 2-3 features for pattern analysis
4. Don't read every file - look for patterns`,
  },
  {
    id: 'java-clean-code',
    name: 'clean-code',
    description: 'Clean Code principles (DRY, KISS, YAGNI), naming conventions, function design, and refactoring for Java.',
    category: 'java',
    trigger: '/java-clean',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# Clean Code Skill

Write readable, maintainable code following Clean Code principles.

## When to Use
- User says "clean this code" / "refactor" / "improve readability"
- Code review focusing on maintainability
- Reducing complexity
- Improving naming

---

## Core Principles

| Principle | Meaning | Violation Sign |
|-----------|---------|----------------|
| **DRY** | Don't Repeat Yourself | Copy-pasted code blocks |
| **KISS** | Keep It Simple, Stupid | Over-engineered solutions |
| **YAGNI** | You Aren't Gonna Need It | Features "just in case" |

---

## DRY - Don't Repeat Yourself

> "Every piece of knowledge must have a single, unambiguous representation in the system."

### Violation

\`\`\`java
// ❌ BAD: Same validation logic repeated
public class UserController {

    public void createUser(UserRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new ValidationException("Email is required");
        }
        if (!request.getEmail().contains("@")) {
            throw new ValidationException("Invalid email format");
        }
        // ... create user
    }

    public void updateUser(UserRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new ValidationException("Email is required");
        }
        if (!request.getEmail().contains("@")) {
            throw new ValidationException("Invalid email format");
        }
        // ... update user
    }
}
\`\`\`

### Refactored

\`\`\`java
// ✅ GOOD: Single source of truth
public class EmailValidator {

    public void validate(String email) {
        if (email == null || email.isBlank()) {
            throw new ValidationException("Email is required");
        }
        if (!email.contains("@")) {
            throw new ValidationException("Invalid email format");
        }
    }
}

public class UserController {
    private final EmailValidator emailValidator;

    public void createUser(UserRequest request) {
        emailValidator.validate(request.getEmail());
        // ... create user
    }

    public void updateUser(UserRequest request) {
        emailValidator.validate(request.getEmail());
        // ... update user
    }
}
\`\`\`

### DRY Exceptions

Not all duplication is bad. Avoid premature abstraction:

\`\`\`java
// These look similar but serve different purposes - OK to duplicate
public BigDecimal calculateShippingCost(Order order) {
    return order.getWeight().multiply(SHIPPING_RATE);
}

public BigDecimal calculateInsuranceCost(Order order) {
    return order.getValue().multiply(INSURANCE_RATE);
}
// Don't force these into one method - they'll evolve differently
\`\`\`

---

## KISS - Keep It Simple

> "The simplest solution is usually the best."

### Violation

\`\`\`java
// ❌ BAD: Over-engineered for simple task
public class StringUtils {

    public boolean isEmpty(String str) {
        return Optional.ofNullable(str)
            .map(String::trim)
            .map(String::isEmpty)
            .orElseGet(() -> Boolean.TRUE);
    }
}
\`\`\`

### Refactored

\`\`\`java
// ✅ GOOD: Simple and clear
public class StringUtils {

    public boolean isEmpty(String str) {
        return str == null || str.trim().isEmpty();
    }

    // Or use existing library
    // return StringUtils.isBlank(str);  // Apache Commons
    // return str == null || str.isBlank();  // Java 11+
}
\`\`\`

### KISS Checklist

- Can a junior developer understand this in 30 seconds?
- Is there a simpler way using standard libraries?
- Am I adding complexity for edge cases that may never happen?

---

## YAGNI - You Aren't Gonna Need It

> "Don't add functionality until it's necessary."

### Violation

\`\`\`java
// ❌ BAD: Building for hypothetical future
public interface Repository<T, ID> {
    T findById(ID id);
    List<T> findAll();
    List<T> findAll(Pageable pageable);
    List<T> findAll(Sort sort);
    List<T> findAllById(Iterable<ID> ids);
    T save(T entity);
    List<T> saveAll(Iterable<T> entities);
    void delete(T entity);
    void deleteById(ID id);
    void deleteAll(Iterable<T> entities);
    void deleteAll();
    boolean existsById(ID id);
    long count();
    // ... 20 more methods "just in case"
}

// Current usage: only findById and save
\`\`\`

### Refactored

\`\`\`java
// ✅ GOOD: Only what's needed now
public interface UserRepository {
    Optional<User> findById(Long id);
    User save(User user);
}

// Add methods when actually needed, not before
\`\`\`

### YAGNI Signs

- "We might need this later"
- "Let's make it configurable just in case"
- "What if we need to support X in the future?"
- Abstract classes with one implementation

---

## Naming Conventions

### Variables

\`\`\`java
// ❌ BAD
int d;                  // What is d?
String s;               // Meaningless
List<User> list;        // What kind of list?
Map<String, Object> m;  // What does it map?

// ✅ GOOD
int elapsedTimeInDays;
String customerName;
List<User> activeUsers;
Map<String, Object> sessionAttributes;
\`\`\`

### Booleans

\`\`\`java
// ❌ BAD
boolean flag;
boolean status;
boolean check;

// ✅ GOOD - Use is/has/can/should prefix
boolean isActive;
boolean hasPermission;
boolean canEdit;
boolean shouldNotify;
\`\`\`

### Methods

\`\`\`java
// ❌ BAD
void process();           // Process what?
void handle();            // Handle what?
void doIt();              // Do what?
User get();               // Get from where?

// ✅ GOOD - Verb + noun, descriptive
void processPayment();
void handleLoginRequest();
void sendWelcomeEmail();
User findByEmail(String email);
List<Order> fetchPendingOrders();
\`\`\`

### Classes

\`\`\`java
// ❌ BAD
class Data { }           // Too vague
class Info { }           // Too vague
class Manager { }        // Often a god class
class Helper { }         // Often a dumping ground
class Utils { }          // Static method dumping ground

// ✅ GOOD - Noun, specific responsibility
class User { }
class OrderProcessor { }
class EmailValidator { }
class PaymentGateway { }
class ShippingCalculator { }
\`\`\`

### Naming Conventions Table

| Element | Convention | Example |
|---------|------------|---------|
| Class | PascalCase, noun | \`OrderService\` |
| Interface | PascalCase, adjective or noun | \`Comparable\`, \`List\` |
| Method | camelCase, verb | \`calculateTotal()\` |
| Variable | camelCase, noun | \`customerEmail\` |
| Constant | UPPER_SNAKE | \`MAX_RETRY_COUNT\` |
| Package | lowercase | \`com.example.orders\` |

---

## Functions / Methods

### Keep Functions Small

\`\`\`java
// ❌ BAD: 50+ line method doing multiple things
public void processOrder(Order order) {
    // validate order (10 lines)
    // calculate totals (15 lines)
    // apply discounts (10 lines)
    // update inventory (10 lines)
    // send notifications (10 lines)
    // ... and more
}

// ✅ GOOD: Small, focused methods
public void processOrder(Order order) {
    validateOrder(order);
    calculateTotals(order);
    applyDiscounts(order);
    updateInventory(order);
    sendNotifications(order);
}
\`\`\`

### Single Level of Abstraction

\`\`\`java
// ❌ BAD: Mixed abstraction levels
public void processOrder(Order order) {
    validateOrder(order);  // High level

    // Low level mixed in
    BigDecimal total = BigDecimal.ZERO;
    for (OrderItem item : order.getItems()) {
        total = total.add(item.getPrice().multiply(
            BigDecimal.valueOf(item.getQuantity())));
    }

    sendEmail(order);  // High level again
}

// ✅ GOOD: Consistent abstraction level
public void processOrder(Order order) {
    validateOrder(order);
    calculateTotal(order);
    sendConfirmation(order);
}

private BigDecimal calculateTotal(Order order) {
    return order.getItems().stream()
        .map(item -> item.getPrice().multiply(
            BigDecimal.valueOf(item.getQuantity())))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
}
\`\`\`

### Limit Parameters

\`\`\`java
// ❌ BAD: Too many parameters
public User createUser(String firstName, String lastName,
                       String email, String phone,
                       String address, String city,
                       String country, String zipCode) {
    // ...
}

// ✅ GOOD: Use parameter object
public User createUser(CreateUserRequest request) {
    // ...
}

// Or builder
public User createUser(UserBuilder builder) {
    // ...
}
\`\`\`

### Avoid Flag Arguments

\`\`\`java
// ❌ BAD: Boolean flag changes behavior
public void sendMessage(String message, boolean isUrgent) {
    if (isUrgent) {
        // send immediately
    } else {
        // queue for later
    }
}

// ✅ GOOD: Separate methods
public void sendUrgentMessage(String message) {
    // send immediately
}

public void queueMessage(String message) {
    // queue for later
}
\`\`\`

---

## Comments

### Avoid Obvious Comments

\`\`\`java
// ❌ BAD: Noise comments
// Set the user's name
user.setName(name);

// Increment counter
counter++;

// Check if user is null
if (user != null) {
    // ...
}
\`\`\`

### Good Comments

\`\`\`java
// ✅ GOOD: Explain WHY, not WHAT

// Retry with exponential backoff to avoid overwhelming the server
// during high load periods (see incident #1234)
for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
    Thread.sleep((long) Math.pow(2, attempt) * 1000);
    // ...
}

// TODO: Replace with Redis cache after infrastructure upgrade (Q2 2026)
private Map<String, User> userCache = new ConcurrentHashMap<>();

// WARNING: Order matters! Discounts must be applied before tax calculation
applyDiscounts(order);
calculateTax(order);
\`\`\`

### Let Code Speak

\`\`\`java
// ❌ BAD: Comment explaining bad code
// Check if the user is an admin or has special permission
// and the action is allowed for their role
if ((user.getRole() == 1 || user.getRole() == 2) &&
    (action == 3 || action == 4 || action == 7)) {
    // ...
}

// ✅ GOOD: Self-documenting code
if (user.hasAdminPrivileges() && action.isAllowedFor(user.getRole())) {
    // ...
}
\`\`\`

---

## Common Code Smells

| Smell | Description | Refactoring |
|-------|-------------|-------------|
| **Long Method** | Method > 20 lines | Extract Method |
| **Long Parameter List** | > 3 parameters | Parameter Object |
| **Duplicate Code** | Same code in multiple places | Extract Method/Class |
| **Dead Code** | Unused code | Delete it |
| **Magic Numbers** | Unexplained literals | Named Constants |
| **God Class** | Class doing too much | Extract Class |
| **Feature Envy** | Method uses another class's data | Move Method |
| **Primitive Obsession** | Primitives instead of objects | Value Objects |

### Magic Numbers

\`\`\`java
// ❌ BAD
if (user.getAge() >= 18) { }
if (order.getTotal() > 100) { }
Thread.sleep(86400000);

// ✅ GOOD
private static final int ADULT_AGE = 18;
private static final BigDecimal FREE_SHIPPING_THRESHOLD = new BigDecimal("100");
private static final long ONE_DAY_MS = TimeUnit.DAYS.toMillis(1);

if (user.getAge() >= ADULT_AGE) { }
if (order.getTotal().compareTo(FREE_SHIPPING_THRESHOLD) > 0) { }
Thread.sleep(ONE_DAY_MS);
\`\`\`

### Primitive Obsession

\`\`\`java
// ❌ BAD: Primitives everywhere
public void createUser(String email, String phone, String zipCode) {
    // No validation, easy to mix up parameters
}

createUser("12345", "john@email.com", "555-1234");  // Wrong order, compiles!

// ✅ GOOD: Value objects
public record Email(String value) {
    public Email {
        if (!value.contains("@")) {
            throw new IllegalArgumentException("Invalid email");
        }
    }
}

public record PhoneNumber(String value) {
    // validation
}

public void createUser(Email email, PhoneNumber phone, ZipCode zipCode) {
    // Type-safe, self-validating
}
\`\`\`

---

## Refactoring Quick Reference

| From | To | Technique |
|------|-----|-----------|
| Long method | Short methods | Extract Method |
| Duplicate code | Single method | Extract Method |
| Complex conditional | Polymorphism | Replace Conditional with Polymorphism |
| Many parameters | Object | Introduce Parameter Object |
| Temp variables | Query method | Replace Temp with Query |
| Comments explaining code | Self-documenting code | Rename, Extract |
| Nested conditionals | Early return | Guard Clauses |

### Guard Clauses

\`\`\`java
// ❌ BAD: Deeply nested
public void processOrder(Order order) {
    if (order != null) {
        if (order.isValid()) {
            if (order.hasItems()) {
                // actual logic buried here
            }
        }
    }
}

// ✅ GOOD: Guard clauses
public void processOrder(Order order) {
    if (order == null) return;
    if (!order.isValid()) return;
    if (!order.hasItems()) return;

    // actual logic at top level
}
\`\`\`

---

## Clean Code Checklist

When reviewing code, check:

- [ ] Are names meaningful and pronounceable?
- [ ] Are functions small and focused?
- [ ] Is there any duplicated code?
- [ ] Are there magic numbers or strings?
- [ ] Are comments explaining "why" not "what"?
- [ ] Is the code at consistent abstraction level?
- [ ] Can any code be simplified?
- [ ] Is there dead/unused code?

---

## Related Skills

- \`solid-principles\` - Design principles for class structure
- \`design-patterns\` - Common solutions to recurring problems
- \`java-code-review\` - Comprehensive review checklist`,
  },
  {
    id: 'java-concurrency-review',
    name: 'concurrency-review',
    description: 'Review Java concurrency for thread safety, race conditions, deadlocks, and modern patterns (Virtual Threads).',
    category: 'java',
    trigger: '/java-concurrency',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# Concurrency Review Skill

Review Java concurrent code for correctness, safety, and modern best practices.

## Why This Matters

> Nearly 60% of multithreaded applications encounter issues due to improper management of shared resources. - ACM Study

Concurrency bugs are:
- **Hard to reproduce** - timing-dependent
- **Hard to test** - may only appear under load
- **Hard to debug** - non-deterministic behavior

This skill helps catch issues **before** they reach production.

## When to Use
- Reviewing code with \`synchronized\`, \`volatile\`, \`Lock\`
- Checking \`@Async\`, \`CompletableFuture\`, \`ExecutorService\`
- Validating thread safety of shared state
- Reviewing Virtual Threads / Structured Concurrency code
- Any code accessed by multiple threads

---

## Modern Java (21/25): Virtual Threads

### When to Use Virtual Threads

\`\`\`java
// ✅ Perfect for I/O-bound tasks (HTTP, DB, file I/O)
try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (Request request : requests) {
        executor.submit(() -> callExternalApi(request));
    }
}

// ❌ Not beneficial for CPU-bound tasks
// Use platform threads / ForkJoinPool instead
\`\`\`

**Rule of thumb**: If your app never has 10,000+ concurrent tasks, virtual threads may not provide significant benefit.

### Java 25: Synchronized Pinning Fixed

In Java 21-23, virtual threads became "pinned" when entering \`synchronized\` blocks with blocking operations. **Java 25 fixes this** (JEP 491).

\`\`\`java
// In Java 21-23: ⚠️ Could cause pinning
synchronized (lock) {
    blockingIoCall();  // Virtual thread pinned to carrier
}

// In Java 25: ✅ No longer an issue
// But consider ReentrantLock for explicit control anyway
\`\`\`

### ScopedValue Over ThreadLocal

\`\`\`java
// ❌ ThreadLocal problematic with virtual threads
private static final ThreadLocal<User> currentUser = new ThreadLocal<>();

// ✅ ScopedValue (Java 21+ preview, improved in 25)
private static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

ScopedValue.where(CURRENT_USER, user).run(() -> {
    // CURRENT_USER.get() available here and in child virtual threads
    processRequest();
});
\`\`\`

### Structured Concurrency (Java 25 Preview)

\`\`\`java
// ✅ Structured concurrency - tasks tied to scope lifecycle
try (StructuredTaskScope.ShutdownOnFailure scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Subtask<User> userTask = scope.fork(() -> fetchUser(id));
    Subtask<Orders> ordersTask = scope.fork(() -> fetchOrders(id));

    scope.join();            // Wait for all
    scope.throwIfFailed();   // Propagate exceptions

    return new Profile(userTask.get(), ordersTask.get());
}
// All subtasks automatically cancelled if scope exits
\`\`\`

---

## Spring @Async Pitfalls

### 1. Forgetting @EnableAsync

\`\`\`java
// ❌ @Async silently ignored
@Service
public class EmailService {
    @Async
    public void sendEmail(String to) { }
}

// ✅ Enable async processing
@Configuration
@EnableAsync
public class AsyncConfig { }
\`\`\`

### 2. Calling Async from Same Class

\`\`\`java
@Service
public class OrderService {

    // ❌ Bypasses proxy - runs synchronously!
    public void processOrder(Order order) {
        sendConfirmation(order);  // Direct call, not async
    }

    @Async
    public void sendConfirmation(Order order) { }
}

// ✅ Inject self or use separate service
@Service
public class OrderService {
    @Autowired
    private EmailService emailService;  // Separate bean

    public void processOrder(Order order) {
        emailService.sendConfirmation(order);  // Proxy call, async works
    }
}
\`\`\`

### 3. @Async on Non-Public Methods

\`\`\`java
// ❌ Non-public methods - proxy can't intercept
@Async
private void processInBackground() { }

@Async
protected void processInBackground() { }

// ✅ Must be public
@Async
public void processInBackground() { }
\`\`\`

### 4. Default Executor Creates Thread Per Task

\`\`\`java
// ❌ Default SimpleAsyncTaskExecutor - creates new thread each time!
// Can cause OutOfMemoryError under load

// ✅ Configure proper thread pool
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("async-");
        executor.setRejectedExecutionHandler(new CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
\`\`\`

### 5. SecurityContext Not Propagating

\`\`\`java
// ❌ SecurityContextHolder is ThreadLocal-bound
@Async
public void auditAction() {
    // SecurityContextHolder.getContext() is NULL here!
    String user = SecurityContextHolder.getContext().getAuthentication().getName();
}

// ✅ Use DelegatingSecurityContextAsyncTaskExecutor
@Bean
public Executor taskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    // ... configure ...
    return new DelegatingSecurityContextAsyncTaskExecutor(executor);
}
\`\`\`

---

## CompletableFuture Patterns

### Error Handling

\`\`\`java
// ❌ Exception silently swallowed
CompletableFuture.supplyAsync(() -> riskyOperation());
// If riskyOperation throws, nobody knows

// ✅ Always handle exceptions
CompletableFuture.supplyAsync(() -> riskyOperation())
    .exceptionally(ex -> {
        log.error("Operation failed", ex);
        return fallbackValue;
    });

// ✅ Or use handle() for both success and failure
CompletableFuture.supplyAsync(() -> riskyOperation())
    .handle((result, ex) -> {
        if (ex != null) {
            log.error("Failed", ex);
            return fallbackValue;
        }
        return result;
    });
\`\`\`

### Timeout Handling (Java 9+)

\`\`\`java
// ✅ Fail after timeout
CompletableFuture.supplyAsync(() -> slowOperation())
    .orTimeout(5, TimeUnit.SECONDS);  // Throws TimeoutException

// ✅ Return default after timeout
CompletableFuture.supplyAsync(() -> slowOperation())
    .completeOnTimeout(defaultValue, 5, TimeUnit.SECONDS);
\`\`\`

### Combining Futures

\`\`\`java
// ✅ Wait for all
CompletableFuture.allOf(future1, future2, future3)
    .thenRun(() -> log.info("All completed"));

// ✅ Wait for first
CompletableFuture.anyOf(future1, future2, future3)
    .thenAccept(result -> log.info("First result: {}", result));

// ✅ Combine results
future1.thenCombine(future2, (r1, r2) -> merge(r1, r2));
\`\`\`

### Use Appropriate Executor

\`\`\`java
// ❌ CPU-bound task in ForkJoinPool.commonPool (default)
CompletableFuture.supplyAsync(() -> cpuIntensiveWork());

// ✅ Custom executor for blocking/I/O operations
ExecutorService ioExecutor = Executors.newFixedThreadPool(20);
CompletableFuture.supplyAsync(() -> blockingIoCall(), ioExecutor);

// ✅ In Java 21+, virtual threads for I/O
ExecutorService virtualExecutor = Executors.newVirtualThreadPerTaskExecutor();
CompletableFuture.supplyAsync(() -> blockingIoCall(), virtualExecutor);
\`\`\`

---

## Classic Concurrency Issues

### Race Conditions: Check-Then-Act

\`\`\`java
// ❌ Race condition
if (!map.containsKey(key)) {
    map.put(key, computeValue());  // Another thread may have added it
}

// ✅ Atomic operation
map.computeIfAbsent(key, k -> computeValue());

// ❌ Race condition with counter
if (count < MAX) {
    count++;  // Read-check-write is not atomic
}

// ✅ Atomic counter
AtomicInteger count = new AtomicInteger();
count.updateAndGet(c -> c < MAX ? c + 1 : c);
\`\`\`

### Visibility: Missing volatile

\`\`\`java
// ❌ Other threads may never see the update
private boolean running = true;

public void stop() {
    running = false;  // May not be visible to other threads
}

public void run() {
    while (running) { }  // May loop forever
}

// ✅ Volatile ensures visibility
private volatile boolean running = true;
\`\`\`

### Non-Atomic long/double

\`\`\`java
// ❌ 64-bit read/write is non-atomic on 32-bit JVMs
private long counter;

public void increment() {
    counter++;  // Not atomic!
}

// ✅ Use AtomicLong or synchronization
private AtomicLong counter = new AtomicLong();

// ✅ Or volatile (for single-writer scenarios)
private volatile long counter;
\`\`\`

### Double-Checked Locking

\`\`\`java
// ❌ Broken without volatile
private static Singleton instance;

public static Singleton getInstance() {
    if (instance == null) {
        synchronized (Singleton.class) {
            if (instance == null) {
                instance = new Singleton();  // May be seen partially constructed
            }
        }
    }
    return instance;
}

// ✅ Correct with volatile
private static volatile Singleton instance;

// ✅ Or use holder class idiom
private static class Holder {
    static final Singleton INSTANCE = new Singleton();
}

public static Singleton getInstance() {
    return Holder.INSTANCE;
}
\`\`\`

### Deadlocks: Lock Ordering

\`\`\`java
// ❌ Potential deadlock
// Thread 1: lock(A) -> lock(B)
// Thread 2: lock(B) -> lock(A)

public void transfer(Account from, Account to, int amount) {
    synchronized (from) {
        synchronized (to) {
            // Transfer logic
        }
    }
}

// ✅ Consistent lock ordering
public void transfer(Account from, Account to, int amount) {
    Account first = from.getId() < to.getId() ? from : to;
    Account second = from.getId() < to.getId() ? to : from;

    synchronized (first) {
        synchronized (second) {
            // Transfer logic
        }
    }
}
\`\`\`

---

## Thread-Safe Collections

### Choose the Right Collection

| Use Case | Wrong | Right |
|----------|-------|-------|
| Concurrent reads/writes | \`HashMap\` | \`ConcurrentHashMap\` |
| Frequent iteration | \`ConcurrentHashMap\` | \`CopyOnWriteArrayList\` |
| Producer-consumer | \`ArrayList\` | \`BlockingQueue\` |
| Sorted concurrent | \`TreeMap\` | \`ConcurrentSkipListMap\` |

### ConcurrentHashMap Pitfalls

\`\`\`java
// ❌ Non-atomic compound operation
if (!map.containsKey(key)) {
    map.put(key, value);
}

// ✅ Atomic
map.putIfAbsent(key, value);
map.computeIfAbsent(key, k -> createValue());

// ❌ Nested compute can deadlock
map.compute(key1, (k, v) -> {
    return map.compute(key2, ...);  // Deadlock risk!
});
\`\`\`

---

## Concurrency Review Checklist

### 🔴 High Severity (Likely Bugs)
- [ ] No check-then-act on shared state without synchronization
- [ ] No \`synchronized\` calling external/unknown code (deadlock risk)
- [ ] \`volatile\` present for double-checked locking
- [ ] Non-volatile fields not read in loops waiting for updates
- [ ] \`ConcurrentHashMap.compute()\` doesn't call other map operations
- [ ] @Async methods are public and called from different beans

### 🟡 Medium Severity (Potential Issues)
- [ ] Thread pools properly sized and named
- [ ] CompletableFuture exceptions handled (exceptionally/handle)
- [ ] SecurityContext propagated to async tasks if needed
- [ ] \`ExecutorService\` properly shut down
- [ ] \`Lock.unlock()\` in finally block
- [ ] Thread-safe collections used for shared data

### 🟢 Modern Patterns (Java 21/25)
- [ ] Virtual threads used for I/O-bound concurrent tasks
- [ ] ScopedValue considered over ThreadLocal
- [ ] Structured concurrency for related subtasks
- [ ] Timeouts on CompletableFuture operations

### 📝 Documentation
- [ ] Thread safety documented on shared classes
- [ ] Locking order documented for nested locks
- [ ] Each \`volatile\` usage justified

---

## Analysis Commands

\`\`\`bash
# Find synchronized blocks
grep -rn "synchronized" --include="*.java"

# Find @Async methods
grep -rn "@Async" --include="*.java"

# Find volatile fields
grep -rn "volatile" --include="*.java"

# Find thread pool creation
grep -rn "Executors\\.\\|ThreadPoolExecutor\\|ExecutorService" --include="*.java"

# Find CompletableFuture without error handling
grep -rn "CompletableFuture\\." --include="*.java" | grep -v "exceptionally\\|handle\\|whenComplete"

# Find ThreadLocal (consider ScopedValue in Java 21+)
grep -rn "ThreadLocal" --include="*.java"
\`\`\``,
  },
  {
    id: 'java-design-patterns',
    name: 'design-patterns',
    description: 'Common design patterns with Java examples: Factory, Builder, Strategy, Observer, Decorator, etc.',
    category: 'java',
    trigger: '/java-patterns',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# Design Patterns Skill

Practical design patterns reference for Java with modern examples.

## When to Use
- User asks to implement a specific pattern
- Designing extensible/flexible components
- Refactoring rigid code structures
- Code review suggests pattern usage

---

## Quick Reference: When to Use What

| Problem | Pattern |
|---------|---------|
| Complex object construction | **Builder** |
| Create objects without specifying class | **Factory** |
| Multiple algorithms, swap at runtime | **Strategy** |
| Add behavior without changing class | **Decorator** |
| Notify multiple objects of changes | **Observer** |
| Ensure single instance | **Singleton** |
| Convert incompatible interfaces | **Adapter** |
| Define algorithm skeleton | **Template Method** |

---

## Creational Patterns

### Builder

**Use when:** Object has many parameters, some optional.

\`\`\`java
// ❌ Telescoping constructor antipattern
public class User {
    public User(String name) { }
    public User(String name, String email) { }
    public User(String name, String email, int age) { }
    public User(String name, String email, int age, String phone) { }
    // ... explosion of constructors
}

// ✅ Builder pattern
public class User {
    private final String name;      // required
    private final String email;     // required
    private final int age;          // optional
    private final String phone;     // optional
    private final String address;   // optional

    private User(Builder builder) {
        this.name = builder.name;
        this.email = builder.email;
        this.age = builder.age;
        this.phone = builder.phone;
        this.address = builder.address;
    }

    public static Builder builder(String name, String email) {
        return new Builder(name, email);
    }

    public static class Builder {
        // Required
        private final String name;
        private final String email;
        // Optional with defaults
        private int age = 0;
        private String phone = "";
        private String address = "";

        private Builder(String name, String email) {
            this.name = name;
            this.email = email;
        }

        public Builder age(int age) {
            this.age = age;
            return this;
        }

        public Builder phone(String phone) {
            this.phone = phone;
            return this;
        }

        public Builder address(String address) {
            this.address = address;
            return this;
        }

        public User build() {
            return new User(this);
        }
    }
}

// Usage
User user = User.builder("John", "john@example.com")
    .age(30)
    .phone("+1234567890")
    .build();
\`\`\`

**With Lombok:**
\`\`\`java
@Builder
@Getter
public class User {
    private final String name;
    private final String email;
    @Builder.Default private int age = 0;
    private String phone;
}
\`\`\`

---

### Factory Method

**Use when:** Need to create objects without specifying exact class.

\`\`\`java
// ✅ Factory Method pattern
public interface Notification {
    void send(String message);
}

public class EmailNotification implements Notification {
    @Override
    public void send(String message) {
        System.out.println("Email: " + message);
    }
}

public class SmsNotification implements Notification {
    @Override
    public void send(String message) {
        System.out.println("SMS: " + message);
    }
}

public class PushNotification implements Notification {
    @Override
    public void send(String message) {
        System.out.println("Push: " + message);
    }
}

// Factory
public class NotificationFactory {

    public static Notification create(String type) {
        return switch (type.toUpperCase()) {
            case "EMAIL" -> new EmailNotification();
            case "SMS" -> new SmsNotification();
            case "PUSH" -> new PushNotification();
            default -> throw new IllegalArgumentException("Unknown type: " + type);
        };
    }
}

// Usage
Notification notification = NotificationFactory.create("EMAIL");
notification.send("Hello!");
\`\`\`

**With Spring (preferred):**
\`\`\`java
public interface NotificationSender {
    void send(String message);
    String getType();
}

@Component
public class EmailSender implements NotificationSender {
    @Override public void send(String message) { /* ... */ }
    @Override public String getType() { return "EMAIL"; }
}

@Component
public class SmsSender implements NotificationSender {
    @Override public void send(String message) { /* ... */ }
    @Override public String getType() { return "SMS"; }
}

@Component
public class NotificationFactory {
    private final Map<String, NotificationSender> senders;

    public NotificationFactory(List<NotificationSender> senderList) {
        this.senders = senderList.stream()
            .collect(Collectors.toMap(
                NotificationSender::getType,
                Function.identity()
            ));
    }

    public NotificationSender getSender(String type) {
        return Optional.ofNullable(senders.get(type))
            .orElseThrow(() -> new IllegalArgumentException("Unknown: " + type));
    }
}
\`\`\`

---

### Singleton

**Use when:** Exactly one instance needed (use sparingly!).

\`\`\`java
// ✅ Modern singleton (enum-based, thread-safe)
public enum DatabaseConnection {
    INSTANCE;

    private Connection connection;

    DatabaseConnection() {
        // Initialize connection
    }

    public Connection getConnection() {
        return connection;
    }
}

// Usage
Connection conn = DatabaseConnection.INSTANCE.getConnection();
\`\`\`

**With Spring (preferred):**
\`\`\`java
@Component  // Default scope is singleton
public class DatabaseConnection {
    // Spring manages single instance
}
\`\`\`

**Warning:** Singletons can be problematic:
- Hard to test (global state)
- Hidden dependencies
- Consider dependency injection instead

---

## Behavioral Patterns

### Strategy

**Use when:** Multiple algorithms for same operation, need to swap at runtime.

\`\`\`java
// ✅ Strategy pattern
public interface PaymentStrategy {
    void pay(BigDecimal amount);
}

public class CreditCardPayment implements PaymentStrategy {
    private final String cardNumber;

    public CreditCardPayment(String cardNumber) {
        this.cardNumber = cardNumber;
    }

    @Override
    public void pay(BigDecimal amount) {
        System.out.println("Paid " + amount + " with card " + cardNumber);
    }
}

public class PayPalPayment implements PaymentStrategy {
    private final String email;

    public PayPalPayment(String email) {
        this.email = email;
    }

    @Override
    public void pay(BigDecimal amount) {
        System.out.println("Paid " + amount + " via PayPal: " + email);
    }
}

public class CryptoPayment implements PaymentStrategy {
    private final String walletAddress;

    public CryptoPayment(String walletAddress) {
        this.walletAddress = walletAddress;
    }

    @Override
    public void pay(BigDecimal amount) {
        System.out.println("Paid " + amount + " to wallet: " + walletAddress);
    }
}

// Context
public class ShoppingCart {
    private PaymentStrategy paymentStrategy;

    public void setPaymentStrategy(PaymentStrategy strategy) {
        this.paymentStrategy = strategy;
    }

    public void checkout(BigDecimal total) {
        paymentStrategy.pay(total);
    }
}

// Usage
ShoppingCart cart = new ShoppingCart();
cart.setPaymentStrategy(new CreditCardPayment("4111-1111-1111-1111"));
cart.checkout(new BigDecimal("99.99"));

// Change strategy at runtime
cart.setPaymentStrategy(new PayPalPayment("user@example.com"));
cart.checkout(new BigDecimal("49.99"));
\`\`\`

**With Java 8+ (functional):**
\`\`\`java
// Strategy as functional interface
@FunctionalInterface
public interface PaymentStrategy {
    void pay(BigDecimal amount);
}

// Usage with lambdas
PaymentStrategy creditCard = amount ->
    System.out.println("Card payment: " + amount);

PaymentStrategy paypal = amount ->
    System.out.println("PayPal payment: " + amount);

cart.setPaymentStrategy(creditCard);
\`\`\`

---

### Observer

**Use when:** Objects need to be notified of changes in another object.

\`\`\`java
// ✅ Observer pattern (modern Java)
public interface OrderObserver {
    void onOrderPlaced(Order order);
}

public class OrderService {
    private final List<OrderObserver> observers = new ArrayList<>();

    public void addObserver(OrderObserver observer) {
        observers.add(observer);
    }

    public void removeObserver(OrderObserver observer) {
        observers.remove(observer);
    }

    public void placeOrder(Order order) {
        // Process order
        saveOrder(order);

        // Notify all observers
        observers.forEach(observer -> observer.onOrderPlaced(order));
    }
}

// Observers
public class InventoryService implements OrderObserver {
    @Override
    public void onOrderPlaced(Order order) {
        // Reduce inventory
        order.getItems().forEach(item ->
            reduceStock(item.getProductId(), item.getQuantity())
        );
    }
}

public class EmailNotificationService implements OrderObserver {
    @Override
    public void onOrderPlaced(Order order) {
        sendConfirmationEmail(order.getCustomerEmail(), order);
    }
}

public class AnalyticsService implements OrderObserver {
    @Override
    public void onOrderPlaced(Order order) {
        trackOrderEvent(order);
    }
}

// Setup
OrderService orderService = new OrderService();
orderService.addObserver(new InventoryService());
orderService.addObserver(new EmailNotificationService());
orderService.addObserver(new AnalyticsService());
\`\`\`

**With Spring Events (preferred):**
\`\`\`java
// Event
public record OrderPlacedEvent(Order order) {}

// Publisher
@Service
public class OrderService {
    private final ApplicationEventPublisher eventPublisher;

    public void placeOrder(Order order) {
        saveOrder(order);
        eventPublisher.publishEvent(new OrderPlacedEvent(order));
    }
}

// Listeners (observers)
@Component
public class InventoryListener {
    @EventListener
    public void handleOrderPlaced(OrderPlacedEvent event) {
        // Reduce inventory
    }
}

@Component
public class EmailListener {
    @EventListener
    public void handleOrderPlaced(OrderPlacedEvent event) {
        // Send email
    }

    @EventListener
    @Async  // Async processing
    public void handleOrderPlacedAsync(OrderPlacedEvent event) {
        // Send email asynchronously
    }
}
\`\`\`

---

### Template Method

**Use when:** Define algorithm skeleton, let subclasses fill in steps.

\`\`\`java
// ✅ Template Method pattern
public abstract class DataProcessor {

    // Template method - defines the algorithm
    public final void process() {
        readData();
        processData();
        writeData();
        if (shouldNotify()) {
            notifyCompletion();
        }
    }

    // Steps to be implemented by subclasses
    protected abstract void readData();
    protected abstract void processData();
    protected abstract void writeData();

    // Hook - optional override
    protected boolean shouldNotify() {
        return true;
    }

    protected void notifyCompletion() {
        System.out.println("Processing completed!");
    }
}

public class CsvDataProcessor extends DataProcessor {
    @Override
    protected void readData() {
        System.out.println("Reading CSV file...");
    }

    @Override
    protected void processData() {
        System.out.println("Processing CSV data...");
    }

    @Override
    protected void writeData() {
        System.out.println("Writing to database...");
    }
}

public class ApiDataProcessor extends DataProcessor {
    @Override
    protected void readData() {
        System.out.println("Fetching from API...");
    }

    @Override
    protected void processData() {
        System.out.println("Transforming API response...");
    }

    @Override
    protected void writeData() {
        System.out.println("Writing to cache...");
    }

    @Override
    protected boolean shouldNotify() {
        return false;  // Override hook
    }
}

// Usage
DataProcessor csvProcessor = new CsvDataProcessor();
csvProcessor.process();

DataProcessor apiProcessor = new ApiDataProcessor();
apiProcessor.process();
\`\`\`

---

## Structural Patterns

### Decorator

**Use when:** Add behavior dynamically without modifying existing classes.

\`\`\`java
// ✅ Decorator pattern
public interface Coffee {
    String getDescription();
    BigDecimal getCost();
}

public class SimpleCoffee implements Coffee {
    @Override
    public String getDescription() {
        return "Coffee";
    }

    @Override
    public BigDecimal getCost() {
        return new BigDecimal("2.00");
    }
}

// Base decorator
public abstract class CoffeeDecorator implements Coffee {
    protected final Coffee coffee;

    public CoffeeDecorator(Coffee coffee) {
        this.coffee = coffee;
    }

    @Override
    public String getDescription() {
        return coffee.getDescription();
    }

    @Override
    public BigDecimal getCost() {
        return coffee.getCost();
    }
}

// Concrete decorators
public class MilkDecorator extends CoffeeDecorator {
    public MilkDecorator(Coffee coffee) {
        super(coffee);
    }

    @Override
    public String getDescription() {
        return coffee.getDescription() + ", Milk";
    }

    @Override
    public BigDecimal getCost() {
        return coffee.getCost().add(new BigDecimal("0.50"));
    }
}

public class SugarDecorator extends CoffeeDecorator {
    public SugarDecorator(Coffee coffee) {
        super(coffee);
    }

    @Override
    public String getDescription() {
        return coffee.getDescription() + ", Sugar";
    }

    @Override
    public BigDecimal getCost() {
        return coffee.getCost().add(new BigDecimal("0.20"));
    }
}

public class WhippedCreamDecorator extends CoffeeDecorator {
    public WhippedCreamDecorator(Coffee coffee) {
        super(coffee);
    }

    @Override
    public String getDescription() {
        return coffee.getDescription() + ", Whipped Cream";
    }

    @Override
    public BigDecimal getCost() {
        return coffee.getCost().add(new BigDecimal("0.70"));
    }
}

// Usage - compose decorators
Coffee coffee = new SimpleCoffee();
coffee = new MilkDecorator(coffee);
coffee = new SugarDecorator(coffee);
coffee = new WhippedCreamDecorator(coffee);

System.out.println(coffee.getDescription());  // Coffee, Milk, Sugar, Whipped Cream
System.out.println(coffee.getCost());         // 3.40
\`\`\`

**Java I/O uses Decorator:**
\`\`\`java
// Classic example from Java
BufferedReader reader = new BufferedReader(
    new InputStreamReader(
        new FileInputStream("file.txt")
    )
);
\`\`\`

---

### Adapter

**Use when:** Make incompatible interfaces work together.

\`\`\`java
// ✅ Adapter pattern

// Existing interface our code uses
public interface MediaPlayer {
    void play(String filename);
}

// Legacy/third-party interface
public class LegacyAudioPlayer {
    public void playMp3(String filename) {
        System.out.println("Playing MP3: " + filename);
    }
}

public class AdvancedVideoPlayer {
    public void playMp4(String filename) {
        System.out.println("Playing MP4: " + filename);
    }

    public void playAvi(String filename) {
        System.out.println("Playing AVI: " + filename);
    }
}

// Adapters
public class Mp3PlayerAdapter implements MediaPlayer {
    private final LegacyAudioPlayer legacyPlayer = new LegacyAudioPlayer();

    @Override
    public void play(String filename) {
        legacyPlayer.playMp3(filename);
    }
}

public class VideoPlayerAdapter implements MediaPlayer {
    private final AdvancedVideoPlayer videoPlayer = new AdvancedVideoPlayer();

    @Override
    public void play(String filename) {
        if (filename.endsWith(".mp4")) {
            videoPlayer.playMp4(filename);
        } else if (filename.endsWith(".avi")) {
            videoPlayer.playAvi(filename);
        }
    }
}

// Usage
MediaPlayer mp3Player = new Mp3PlayerAdapter();
mp3Player.play("song.mp3");

MediaPlayer videoPlayer = new VideoPlayerAdapter();
videoPlayer.play("movie.mp4");
\`\`\`

---

## Pattern Selection Guide

| Situation | Consider |
|-----------|----------|
| Object creation is complex | Builder, Factory |
| Need to add features dynamically | Decorator |
| Multiple implementations of algorithm | Strategy |
| React to state changes | Observer |
| Integrate with legacy code | Adapter |
| Common algorithm, varying steps | Template Method |
| Need single instance | Singleton (use sparingly) |

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Singleton abuse | Global state, hard to test | Dependency Injection |
| Factory everywhere | Over-engineering | Simple \`new\` if type is known |
| Deep decorator chains | Hard to debug | Keep chains short, consider composition |
| Observer with many events | Spaghetti notifications | Event bus, clear event hierarchy |

---

## Related Skills

- \`solid-principles\` - Design principles that patterns help implement
- \`clean-code\` - Code-level best practices
- \`spring-boot-patterns\` - Spring-specific implementations`,
  },
  {
    id: 'java-java-code-review',
    name: 'java-code-review',
    description: 'Systematic code review for Java with null safety, exception handling, concurrency, and performance checks.',
    category: 'java',
    trigger: '/java-review',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# Java Code Review Skill

Systematic code review checklist for Java projects.

## When to Use
- User says "review this code" / "check this PR" / "code review"
- Before merging a PR
- After implementing a feature

## Review Strategy

1. **Quick scan** - Understand intent, identify scope
2. **Checklist pass** - Go through each category below
3. **Summary** - List findings by severity (Critical → Minor)

## Output Format

\`\`\`markdown
## Code Review: [file/feature name]

### Critical
- [Issue description + line reference + suggestion]

### Improvements
- [Suggestion + rationale]

### Minor/Style
- [Nitpicks, optional improvements]

### Good Practices Observed
- [Positive feedback - important for morale]
\`\`\`

---

## Review Checklist

### 1. Null Safety

**Check for:**
\`\`\`java
// ❌ NPE risk
String name = user.getName().toUpperCase();

// ✅ Safe
String name = Optional.ofNullable(user.getName())
    .map(String::toUpperCase)
    .orElse("");

// ✅ Also safe (early return)
if (user.getName() == null) {
    return "";
}
return user.getName().toUpperCase();
\`\`\`

**Flags:**
- Chained method calls without null checks
- Missing \`@Nullable\` / \`@NonNull\` annotations on public APIs
- \`Optional.get()\` without \`isPresent()\` check
- Returning \`null\` from methods that could return \`Optional\` or empty collection

**Suggest:**
- Use \`Optional\` for return types that may be absent
- Use \`Objects.requireNonNull()\` for constructor/method params
- Return empty collections instead of null: \`Collections.emptyList()\`

### 2. Exception Handling

**Check for:**
\`\`\`java
// ❌ Swallowing exceptions
try {
    process();
} catch (Exception e) {
    // silently ignored
}

// ❌ Catching too broad
catch (Exception e) { }
catch (Throwable t) { }

// ❌ Losing stack trace
catch (IOException e) {
    throw new RuntimeException(e.getMessage());
}

// ✅ Proper handling
catch (IOException e) {
    log.error("Failed to process file: {}", filename, e);
    throw new ProcessingException("File processing failed", e);
}
\`\`\`

**Flags:**
- Empty catch blocks
- Catching \`Exception\` or \`Throwable\` broadly
- Losing original exception (not chaining)
- Using exceptions for flow control
- Checked exceptions leaking through API boundaries

**Suggest:**
- Log with context AND stack trace
- Use specific exception types
- Chain exceptions with \`cause\`
- Consider custom exceptions for domain errors

### 3. Collections & Streams

**Check for:**
\`\`\`java
// ❌ Modifying while iterating
for (Item item : items) {
    if (item.isExpired()) {
        items.remove(item);  // ConcurrentModificationException
    }
}

// ✅ Use removeIf
items.removeIf(Item::isExpired);

// ❌ Stream for simple operations
list.stream().forEach(System.out::println);

// ✅ Simple loop is cleaner
for (Item item : list) {
    System.out.println(item);
}

// ❌ Collecting to modify
List<String> names = users.stream()
    .map(User::getName)
    .collect(Collectors.toList());
names.add("extra");  // Might be immutable!

// ✅ Explicit mutable list
List<String> names = users.stream()
    .map(User::getName)
    .collect(Collectors.toCollection(ArrayList::new));
\`\`\`

**Flags:**
- Modifying collections during iteration
- Overusing streams for simple operations
- Assuming \`Collectors.toList()\` returns mutable list
- Not using \`List.of()\`, \`Set.of()\`, \`Map.of()\` for immutable collections
- Parallel streams without understanding implications

**Suggest:**
- \`List.copyOf()\` for defensive copies
- \`removeIf()\` instead of iterator removal
- Streams for transformations, loops for side effects

### 4. Concurrency

**Check for:**
\`\`\`java
// ❌ Not thread-safe
private Map<String, User> cache = new HashMap<>();

// ✅ Thread-safe
private Map<String, User> cache = new ConcurrentHashMap<>();

// ❌ Check-then-act race condition
if (!map.containsKey(key)) {
    map.put(key, computeValue());
}

// ✅ Atomic operation
map.computeIfAbsent(key, k -> computeValue());

// ❌ Double-checked locking (broken without volatile)
if (instance == null) {
    synchronized(this) {
        if (instance == null) {
            instance = new Instance();
        }
    }
}
\`\`\`

**Flags:**
- Shared mutable state without synchronization
- Check-then-act patterns without atomicity
- Missing \`volatile\` on shared variables
- Synchronized on non-final objects
- Thread-unsafe lazy initialization

**Suggest:**
- Prefer immutable objects
- Use \`java.util.concurrent\` classes
- \`AtomicReference\`, \`AtomicInteger\` for simple cases
- Consider \`@ThreadSafe\` / \`@NotThreadSafe\` annotations

### 5. Java Idioms

**equals/hashCode:**
\`\`\`java
// ❌ Only equals without hashCode
@Override
public boolean equals(Object o) { ... }
// Missing hashCode!

// ❌ Mutable fields in hashCode
@Override
public int hashCode() {
    return Objects.hash(id, mutableField);  // Breaks HashMap
}

// ✅ Use immutable fields, implement both
@Override
public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof User user)) return false;
    return Objects.equals(id, user.id);
}

@Override
public int hashCode() {
    return Objects.hash(id);
}
\`\`\`

**toString:**
\`\`\`java
// ❌ Missing - hard to debug
// No toString()

// ❌ Including sensitive data
return "User{password='" + password + "'}";

// ✅ Useful for debugging
@Override
public String toString() {
    return "User{id=" + id + ", name='" + name + "'}";
}
\`\`\`

**Builders:**
\`\`\`java
// ✅ For classes with many optional parameters
User user = User.builder()
    .name("John")
    .email("john@example.com")
    .build();
\`\`\`

**Flags:**
- \`equals\` without \`hashCode\`
- Mutable fields in \`hashCode\`
- Missing \`toString\` on domain objects
- Constructors with > 3-4 parameters (suggest builder)
- Not using \`instanceof\` pattern matching (Java 16+)

### 6. Resource Management

**Check for:**
\`\`\`java
// ❌ Resource leak
FileInputStream fis = new FileInputStream(file);
// ... might throw before close

// ✅ Try-with-resources
try (FileInputStream fis = new FileInputStream(file)) {
    // ...
}

// ❌ Multiple resources, wrong order
try (BufferedWriter writer = new BufferedWriter(new FileWriter(file))) {
    // FileWriter might not be closed if BufferedWriter fails
}

// ✅ Separate declarations
try (FileWriter fw = new FileWriter(file);
     BufferedWriter writer = new BufferedWriter(fw)) {
    // Both properly closed
}
\`\`\`

**Flags:**
- Not using try-with-resources for \`Closeable\`/\`AutoCloseable\`
- Resources opened but not in try-with-resources
- Database connections/statements not properly closed

### 7. API Design

**Check for:**
\`\`\`java
// ❌ Boolean parameters
process(data, true, false);  // What do these mean?

// ✅ Use enums or builder
process(data, ProcessMode.ASYNC, ErrorHandling.STRICT);

// ❌ Returning null for "not found"
public User findById(Long id) {
    return users.get(id);  // null if not found
}

// ✅ Return Optional
public Optional<User> findById(Long id) {
    return Optional.ofNullable(users.get(id));
}

// ❌ Accepting null collections
public void process(List<Item> items) {
    if (items == null) items = Collections.emptyList();
}

// ✅ Require non-null, accept empty
public void process(List<Item> items) {
    Objects.requireNonNull(items, "items must not be null");
}
\`\`\`

**Flags:**
- Boolean parameters (prefer enums)
- Methods with > 3 parameters (consider parameter object)
- Inconsistent null handling across similar methods
- Missing validation on public API inputs

### 8. Performance Considerations

**Check for:**
\`\`\`java
// ❌ String concatenation in loop
String result = "";
for (String s : strings) {
    result += s;  // Creates new String each iteration
}

// ✅ StringBuilder
StringBuilder sb = new StringBuilder();
for (String s : strings) {
    sb.append(s);
}

// ❌ Regex compilation in loop
for (String line : lines) {
    if (line.matches("pattern.*")) { }  // Compiles regex each time
}

// ✅ Pre-compiled pattern
private static final Pattern PATTERN = Pattern.compile("pattern.*");
for (String line : lines) {
    if (PATTERN.matcher(line).matches()) { }
}

// ❌ N+1 in loops
for (User user : users) {
    List<Order> orders = orderRepo.findByUserId(user.getId());
}

// ✅ Batch fetch
Map<Long, List<Order>> ordersByUser = orderRepo.findByUserIds(userIds);
\`\`\`

**Flags:**
- String concatenation in loops
- Regex compilation in loops
- N+1 query patterns
- Creating objects in tight loops that could be reused
- Not using primitive streams (\`IntStream\`, \`LongStream\`)

### 9. Testing Hints

**Suggest tests for:**
- Null inputs
- Empty collections
- Boundary values
- Exception cases
- Concurrent access (if applicable)

---

## Severity Guidelines

| Severity | Criteria |
|----------|----------|
| **Critical** | Security vulnerability, data loss risk, production crash |
| **High** | Bug likely, significant performance issue, breaks API contract |
| **Medium** | Code smell, maintainability issue, missing best practice |
| **Low** | Style, minor optimization, suggestion |

## Token Optimization

- Focus on changed lines (use \`git diff\`)
- Don't repeat obvious issues - group similar findings
- Reference line numbers, not full code quotes
- Skip files that are auto-generated or test fixtures

## Quick Reference Card

| Category | Key Checks |
|----------|------------|
| Null Safety | Chained calls, Optional misuse, null returns |
| Exceptions | Empty catch, broad catch, lost stack trace |
| Collections | Modification during iteration, stream vs loop |
| Concurrency | Shared mutable state, check-then-act |
| Idioms | equals/hashCode pair, toString, builders |
| Resources | try-with-resources, connection leaks |
| API | Boolean params, null handling, validation |
| Performance | String concat, regex in loop, N+1 |`,
  },
  {
    id: 'java-java-migration',
    name: 'java-migration',
    description: 'Guide for upgrading Java projects between major versions (8 to 11 to 17 to 21 to 25).',
    category: 'java',
    trigger: '/java-migrate',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# Java Migration Skill

Step-by-step guide for upgrading Java projects between major versions.

## When to Use
- User says "upgrade to Java 25" / "migrate from Java 8" / "update Java version"
- Modernizing legacy projects
- Spring Boot 2.x → 3.x → 4.x migration
- Preparing for LTS version adoption

## Migration Paths

\`\`\`
Java 8 (LTS) → Java 11 (LTS) → Java 17 (LTS) → Java 21 (LTS) → Java 25 (LTS)
     │              │               │              │               │
     └──────────────┴───────────────┴──────────────┴───────────────┘
                         Always migrate LTS → LTS
\`\`\`

---

## Quick Reference: What Breaks

| From → To | Major Breaking Changes |
|-----------|------------------------|
| 8 → 11 | Removed \`javax.xml.bind\`, module system, internal APIs |
| 11 → 17 | Sealed classes (preview→final), strong encapsulation |
| 17 → 21 | Pattern matching changes, \`finalize()\` deprecated for removal |
| 21 → 25 | Security Manager removed, Unsafe methods removed, 32-bit dropped |

---

## Migration Workflow

### Step 1: Assess Current State

\`\`\`bash
# Check current Java version
java -version

# Check compiler target in Maven
grep -r "maven.compiler" pom.xml

# Find usage of removed APIs
grep -r "sun\\." --include="*.java" src/
grep -r "javax\\.xml\\.bind" --include="*.java" src/
\`\`\`

### Step 2: Update Build Configuration

**Maven:**
\`\`\`xml
<properties>
    <java.version>21</java.version>
    <maven.compiler.source>\${java.version}</maven.compiler.source>
    <maven.compiler.target>\${java.version}</maven.compiler.target>
</properties>

<!-- Or with compiler plugin -->
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-compiler-plugin</artifactId>
    <version>3.12.1</version>
    <configuration>
        <release>21</release>
    </configuration>
</plugin>
\`\`\`

**Gradle:**
\`\`\`groovy
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}
\`\`\`

### Step 3: Fix Compilation Errors

Run compile and fix errors iteratively:
\`\`\`bash
mvn clean compile 2>&1 | head -50
\`\`\`

### Step 4: Run Tests

\`\`\`bash
mvn test
\`\`\`

### Step 5: Check Runtime Warnings

\`\`\`bash
# Run with illegal-access warnings
java --illegal-access=warn -jar app.jar
\`\`\`

---

## Java 8 → 11 Migration

### Removed APIs

| Removed | Replacement |
|---------|-------------|
| \`javax.xml.bind\` (JAXB) | Add dependency: \`jakarta.xml.bind-api\` + \`jaxb-runtime\` |
| \`javax.activation\` | Add dependency: \`jakarta.activation-api\` |
| \`javax.annotation\` | Add dependency: \`jakarta.annotation-api\` |
| \`java.corba\` | No replacement (rarely used) |
| \`java.transaction\` | Add dependency: \`jakarta.transaction-api\` |
| \`sun.misc.Base64*\` | Use \`java.util.Base64\` |
| \`sun.misc.Unsafe\` (partially) | Use \`VarHandle\` where possible |

### Add Missing Dependencies (Maven)

\`\`\`xml
<!-- JAXB (if needed) -->
<dependency>
    <groupId>jakarta.xml.bind</groupId>
    <artifactId>jakarta.xml.bind-api</artifactId>
    <version>4.0.1</version>
</dependency>
<dependency>
    <groupId>org.glassfish.jaxb</groupId>
    <artifactId>jaxb-runtime</artifactId>
    <version>4.0.4</version>
    <scope>runtime</scope>
</dependency>

<!-- Annotation API -->
<dependency>
    <groupId>jakarta.annotation</groupId>
    <artifactId>jakarta.annotation-api</artifactId>
    <version>2.1.1</version>
</dependency>
\`\`\`

### Module System Issues

If using reflection on JDK internals, add JVM flags:
\`\`\`bash
--add-opens java.base/java.lang=ALL-UNNAMED
--add-opens java.base/java.util=ALL-UNNAMED
\`\`\`

**Maven Surefire:**
\`\`\`xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <configuration>
        <argLine>
            --add-opens java.base/java.lang=ALL-UNNAMED
        </argLine>
    </configuration>
</plugin>
\`\`\`

### New Features to Adopt

\`\`\`java
// var (local variable type inference)
var list = new ArrayList<String>();  // instead of ArrayList<String> list = ...

// String methods
"  hello  ".isBlank();      // true for whitespace-only
"  hello  ".strip();        // better trim() (Unicode-aware)
"line1\\nline2".lines();     // Stream<String>
"ha".repeat(3);             // "hahaha"

// Collection factory methods (Java 9+)
List.of("a", "b", "c");     // immutable list
Set.of(1, 2, 3);            // immutable set
Map.of("k1", "v1");         // immutable map

// Optional improvements
optional.ifPresentOrElse(
    value -> process(value),
    () -> handleEmpty()
);

// HTTP Client (replaces HttpURLConnection)
HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.example.com"))
    .build();
HttpResponse<String> response = client.send(request,
    HttpResponse.BodyHandlers.ofString());
\`\`\`

---

## Java 11 → 17 Migration

### Breaking Changes

| Change | Impact |
|--------|--------|
| Strong encapsulation | \`--illegal-access\` no longer works, must use explicit \`--add-opens\` |
| Sealed classes (final) | If you used preview features |
| Pattern matching instanceof | Preview → final syntax change |

### New Features to Adopt

\`\`\`java
// Records (immutable data classes)
public record User(String name, String email) {}
// Auto-generates: constructor, getters, equals, hashCode, toString

// Sealed classes
public sealed class Shape permits Circle, Rectangle {}
public final class Circle extends Shape {}
public final class Rectangle extends Shape {}

// Pattern matching for instanceof
if (obj instanceof String s) {
    System.out.println(s.length());  // s already cast
}

// Switch expressions
String result = switch (day) {
    case MONDAY, FRIDAY -> "Work";
    case SATURDAY, SUNDAY -> "Rest";
    default -> "Midweek";
};

// Text blocks
String json = """
    {
        "name": "John",
        "age": 30
    }
    """;

// Helpful NullPointerException messages
// a.b.c.d() → tells exactly which part was null
\`\`\`

---

## Java 17 → 21 Migration

### Breaking Changes

| Change | Impact |
|--------|--------|
| Pattern matching switch (final) | Minor syntax differences from preview |
| \`finalize()\` deprecated for removal | Replace with \`Cleaner\` or try-with-resources |
| UTF-8 by default | May affect file reading if assumed platform encoding |

### New Features to Adopt

\`\`\`java
// Virtual Threads (Project Loom) - MAJOR
try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(() -> handleRequest());
}
// Or simply:
Thread.startVirtualThread(() -> doWork());

// Pattern matching in switch
String formatted = switch (obj) {
    case Integer i -> "int: " + i;
    case String s -> "string: " + s;
    case null -> "null value";
    default -> "unknown";
};

// Record patterns
record Point(int x, int y) {}
if (obj instanceof Point(int x, int y)) {
    System.out.println(x + ", " + y);
}

// Sequenced Collections
List<String> list = new ArrayList<>();
list.addFirst("first");    // new method
list.addLast("last");      // new method
list.reversed();           // reversed view

// String templates (preview in 21)
// May need --enable-preview

// Scoped Values (preview) - replace ThreadLocal
ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();
ScopedValue.where(CURRENT_USER, user).run(() -> {
    // CURRENT_USER.get() available here
});
\`\`\`

---

## Java 21 → 25 Migration

### Breaking Changes

| Change | Impact |
|--------|--------|
| Security Manager removed | Applications relying on it need alternative security approaches |
| \`sun.misc.Unsafe\` methods removed | Use \`VarHandle\` or FFM API instead |
| 32-bit platforms dropped | No more x86-32 support |
| Record pattern variables final | Cannot reassign pattern variables in switch |
| \`ScopedValue.orElse(null)\` disallowed | Must provide non-null default |
| Dynamic agents restricted | Requires \`-XX:+EnableDynamicAgentLoading\` flag |

### Check for Unsafe Usage

\`\`\`bash
# Find sun.misc.Unsafe usage
grep -rn "sun\\.misc\\.Unsafe" --include="*.java" src/

# Find Security Manager usage
grep -rn "SecurityManager\\|System\\.getSecurityManager" --include="*.java" src/
\`\`\`

### New Features to Adopt

\`\`\`java
// Scoped Values (FINAL in Java 25) - replaces ThreadLocal
private static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

public void handleRequest(User user) {
    ScopedValue.where(CURRENT_USER, user).run(() -> {
        processRequest();  // CURRENT_USER.get() available here and in child threads
    });
}

// Structured Concurrency (Preview, redesigned API in 25)
try (StructuredTaskScope.ShutdownOnFailure scope = StructuredTaskScope.open()) {
    Subtask<User> userTask = scope.fork(() -> fetchUser(id));
    Subtask<Orders> ordersTask = scope.fork(() -> fetchOrders(id));

    scope.join();
    scope.throwIfFailed();

    return new Profile(userTask.get(), ordersTask.get());
}

// Stable Values (Preview) - lazy initialization made easy
private static final StableValue<ExpensiveService> SERVICE =
    StableValue.of(() -> new ExpensiveService());

public void useService() {
    SERVICE.get().doWork();  // Initialized on first access, cached thereafter
}

// Compact Object Headers - automatic, no code changes
// Objects now use 64-bit headers instead of 128-bit (less memory)

// Primitive Patterns in instanceof (Preview)
if (obj instanceof int i) {
    System.out.println("int value: " + i);
}

// Module Import Declarations (Preview)
import module java.sql;  // Import all public types from module
\`\`\`

### Performance Improvements (Automatic)

Java 25 includes several automatic performance improvements:
- **Compact Object Headers**: 8 bytes instead of 16 bytes per object
- **String.hashCode() constant folding**: Faster Map lookups with String keys
- **AOT class loading**: Faster startup with ahead-of-time cache
- **Generational Shenandoah GC**: Better throughput, lower pauses

### Migration with OpenRewrite

\`\`\`bash
# Automated Java 25 migration
mvn -U org.openrewrite.maven:rewrite-maven-plugin:run \\
  -Drewrite.recipeArtifactCoordinates=org.openrewrite.recipe:rewrite-migrate-java:LATEST \\
  -Drewrite.activeRecipes=org.openrewrite.java.migrate.UpgradeToJava25
\`\`\`

---

## Spring Boot Migration

### Spring Boot 2.x → 3.x

**Requirements:**
- Java 17+ (mandatory)
- Jakarta EE 9+ (javax.* → jakarta.*)

**Package Renames:**
\`\`\`java
// Before (Spring Boot 2.x)
import javax.persistence.*;
import javax.validation.*;
import javax.servlet.*;

// After (Spring Boot 3.x)
import jakarta.persistence.*;
import jakarta.validation.*;
import jakarta.servlet.*;
\`\`\`

**Find & Replace:**
\`\`\`bash
# Find all javax imports that need migration
grep -r "import javax\\." --include="*.java" src/ | grep -v "javax.crypto" | grep -v "javax.net"
\`\`\`

**Automated migration:**
\`\`\`bash
# Use OpenRewrite
mvn -U org.openrewrite.maven:rewrite-maven-plugin:run \\
  -Drewrite.recipeArtifactCoordinates=org.openrewrite.recipe:rewrite-spring:LATEST \\
  -Drewrite.activeRecipes=org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_0
\`\`\`

### Dependency Updates (Spring Boot 3.x)

\`\`\`xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.2</version>
</parent>

<!-- Hibernate 6 (auto-included) -->
<!-- Spring Security 6 (auto-included) -->
\`\`\`

### Hibernate 5 → 6 Changes

\`\`\`java
// ID generation strategy changed
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)  // preferred
private Long id;

// Query changes
// Before: createQuery returns raw type
// After: createQuery requires type parameter

// Before
Query query = session.createQuery("from User");

// After
TypedQuery<User> query = session.createQuery("from User", User.class);
\`\`\`

---

## Common Migration Issues

### Issue: Reflection Access Denied

**Symptom:**
\`\`\`
java.lang.reflect.InaccessibleObjectException: Unable to make field accessible
\`\`\`

**Fix:**
\`\`\`bash
--add-opens java.base/java.lang=ALL-UNNAMED
--add-opens java.base/java.lang.reflect=ALL-UNNAMED
\`\`\`

### Issue: JAXB ClassNotFoundException

**Symptom:**
\`\`\`
java.lang.ClassNotFoundException: javax.xml.bind.JAXBContext
\`\`\`

**Fix:** Add JAXB dependencies (see Java 8→11 section)

### Issue: Lombok Not Working

**Fix:** Update Lombok to latest version:
\`\`\`xml
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <version>1.18.30</version>
</dependency>
\`\`\`

### Issue: Test Failures with Mockito

**Fix:** Update Mockito:
\`\`\`xml
<dependency>
    <groupId>org.mockito</groupId>
    <artifactId>mockito-core</artifactId>
    <version>5.8.0</version>
    <scope>test</scope>
</dependency>
\`\`\`

---

## Migration Checklist

### Pre-Migration
- [ ] Document current Java version
- [ ] List all dependencies and their versions
- [ ] Identify usage of internal APIs (\`sun.*\`, \`com.sun.*\`)
- [ ] Check framework compatibility (Spring, Hibernate, etc.)
- [ ] Backup / create branch

### During Migration
- [ ] Update build tool configuration
- [ ] Add missing Jakarta dependencies
- [ ] Fix \`javax.*\` → \`jakarta.*\` imports (if Spring Boot 3)
- [ ] Add \`--add-opens\` flags if needed
- [ ] Update Lombok, Mockito, other tools
- [ ] Fix compilation errors
- [ ] Run tests

### Post-Migration
- [ ] Remove unnecessary \`--add-opens\` flags
- [ ] Adopt new language features (records, var, etc.)
- [ ] Update CI/CD pipeline
- [ ] Document changes made

---

## Quick Commands

\`\`\`bash
# Check Java version
java -version

# Find internal API usage
grep -rn "sun\\.\\|com\\.sun\\." --include="*.java" src/

# Find javax imports (for Jakarta migration)
grep -rn "import javax\\." --include="*.java" src/

# Compile and show first errors
mvn clean compile 2>&1 | head -100

# Run with verbose module warnings
java --illegal-access=debug -jar app.jar

# OpenRewrite Spring Boot 3 migration
mvn org.openrewrite.maven:rewrite-maven-plugin:run \\
  -Drewrite.recipeArtifactCoordinates=org.openrewrite.recipe:rewrite-spring:LATEST \\
  -Drewrite.activeRecipes=org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_0
\`\`\`

---

## Version Compatibility Matrix

| Framework | Java 8 | Java 11 | Java 17 | Java 21 | Java 25 |
|-----------|--------|---------|---------|---------|---------|
| Spring Boot 2.7.x | ✅ | ✅ | ✅ | ⚠️ | ❌ |
| Spring Boot 3.2.x | ❌ | ❌ | ✅ | ✅ | ✅ |
| Spring Boot 3.4+ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Hibernate 5.6 | ✅ | ✅ | ✅ | ⚠️ | ❌ |
| Hibernate 6.4+ | ❌ | ❌ | ✅ | ✅ | ✅ |
| JUnit 5.10+ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mockito 5+ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Lombok 1.18.34+ | ✅ | ✅ | ✅ | ✅ | ✅ |

**LTS Support Timeline:**
- Java 21: Oracle free support until September 2028
- Java 25: Oracle free support until September 2033`,
  },
  {
    id: 'java-jpa-patterns',
    name: 'jpa-patterns',
    description: 'JPA/Hibernate patterns and pitfalls: N+1, lazy loading, transactions, queries.',
    category: 'java',
    trigger: '/java-jpa',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# JPA Patterns Skill

Best practices and common pitfalls for JPA/Hibernate in Spring applications.

## When to Use
- User mentions "N+1 problem" / "too many queries"
- LazyInitializationException errors
- Questions about fetch strategies (EAGER vs LAZY)
- Transaction management issues
- Entity relationship design
- Query optimization

---

## Quick Reference: Common Problems

| Problem | Symptom | Solution |
|---------|---------|----------|
| N+1 queries | Many SELECT statements | JOIN FETCH, @EntityGraph |
| LazyInitializationException | Error outside transaction | Open Session in View, DTO projection, JOIN FETCH |
| Slow queries | Performance issues | Pagination, projections, indexes |
| Dirty checking overhead | Slow updates | Read-only transactions, DTOs |
| Lost updates | Concurrent modifications | Optimistic locking (@Version) |

---

## N+1 Problem

> The #1 JPA performance killer

### The Problem

\`\`\`java
// ❌ BAD: N+1 queries
@Entity
public class Author {
    @Id private Long id;
    private String name;

    @OneToMany(mappedBy = "author", fetch = FetchType.LAZY)
    private List<Book> books;
}

// This innocent code...
List<Author> authors = authorRepository.findAll();  // 1 query
for (Author author : authors) {
    System.out.println(author.getBooks().size());   // N queries!
}
// Result: 1 + N queries (if 100 authors = 101 queries)
\`\`\`

### Solution 1: JOIN FETCH (JPQL)

\`\`\`java
// ✅ GOOD: Single query with JOIN FETCH
public interface AuthorRepository extends JpaRepository<Author, Long> {

    @Query("SELECT a FROM Author a JOIN FETCH a.books")
    List<Author> findAllWithBooks();
}

// Usage - single query
List<Author> authors = authorRepository.findAllWithBooks();
\`\`\`

### Solution 2: @EntityGraph

\`\`\`java
// ✅ GOOD: EntityGraph for declarative fetching
public interface AuthorRepository extends JpaRepository<Author, Long> {

    @EntityGraph(attributePaths = {"books"})
    List<Author> findAll();

    // Or with named graph
    @EntityGraph(value = "Author.withBooks")
    List<Author> findAllWithBooks();
}

// Define named graph on entity
@Entity
@NamedEntityGraph(
    name = "Author.withBooks",
    attributeNodes = @NamedAttributeNode("books")
)
public class Author {
    // ...
}
\`\`\`

### Solution 3: Batch Fetching

\`\`\`java
// ✅ GOOD: Batch fetching (Hibernate-specific)
@Entity
public class Author {

    @OneToMany(mappedBy = "author")
    @BatchSize(size = 25)  // Fetch 25 at a time
    private List<Book> books;
}

// Or globally in application.properties
spring.jpa.properties.hibernate.default_batch_fetch_size=25
\`\`\`

### Detecting N+1

\`\`\`yaml
# Enable SQL logging to detect N+1
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true

logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.type.descriptor.sql.BasicBinder: TRACE
\`\`\`

---

## Lazy Loading

### FetchType Basics

\`\`\`java
@Entity
public class Order {

    // LAZY: Load only when accessed (default for collections)
    @OneToMany(mappedBy = "order", fetch = FetchType.LAZY)
    private List<OrderItem> items;

    // EAGER: Always load immediately (default for @ManyToOne, @OneToOne)
    @ManyToOne(fetch = FetchType.EAGER)  // ⚠️ Usually bad
    private Customer customer;
}
\`\`\`

### Best Practice: Default to LAZY

\`\`\`java
// ✅ GOOD: Always use LAZY, fetch when needed
@Entity
public class Order {

    @ManyToOne(fetch = FetchType.LAZY)  // Override EAGER default
    private Customer customer;

    @OneToMany(mappedBy = "order", fetch = FetchType.LAZY)
    private List<OrderItem> items;
}
\`\`\`

### LazyInitializationException

\`\`\`java
// ❌ BAD: Accessing lazy field outside transaction
@Service
public class OrderService {

    public Order getOrder(Long id) {
        return orderRepository.findById(id).orElseThrow();
    }
}

// In controller (no transaction)
Order order = orderService.getOrder(1L);
order.getItems().size();  // 💥 LazyInitializationException!
\`\`\`

### Solutions for LazyInitializationException

**Solution 1: JOIN FETCH in query**
\`\`\`java
// ✅ Fetch needed associations in query
@Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.id = :id")
Optional<Order> findByIdWithItems(@Param("id") Long id);
\`\`\`

**Solution 2: @Transactional on service method**
\`\`\`java
// ✅ Keep transaction open while accessing
@Service
public class OrderService {

    @Transactional(readOnly = true)
    public OrderDTO getOrderWithItems(Long id) {
        Order order = orderRepository.findById(id).orElseThrow();
        // Access within transaction
        int itemCount = order.getItems().size();
        return new OrderDTO(order, itemCount);
    }
}
\`\`\`

**Solution 3: DTO Projection (recommended)**
\`\`\`java
// ✅ BEST: Return only what you need
public interface OrderSummary {
    Long getId();
    String getStatus();
    int getItemCount();
}

@Query("SELECT o.id as id, o.status as status, SIZE(o.items) as itemCount " +
       "FROM Order o WHERE o.id = :id")
Optional<OrderSummary> findOrderSummary(@Param("id") Long id);
\`\`\`

**Solution 4: Open Session in View (not recommended)**
\`\`\`yaml
# Keeps session open during view rendering
# ⚠️ Can mask N+1 problems, use with caution
spring:
  jpa:
    open-in-view: true  # Default is true
\`\`\`

---

## Transactions

### Basic Transaction Management

\`\`\`java
@Service
public class OrderService {

    // Read-only: Optimized, no dirty checking
    @Transactional(readOnly = true)
    public Order findById(Long id) {
        return orderRepository.findById(id).orElseThrow();
    }

    // Write: Full transaction with dirty checking
    @Transactional
    public Order createOrder(CreateOrderRequest request) {
        Order order = new Order();
        // ... set properties
        return orderRepository.save(order);
    }

    // Explicit rollback
    @Transactional(rollbackFor = Exception.class)
    public void processPayment(Long orderId) throws PaymentException {
        // Rolls back on any exception, not just RuntimeException
    }
}
\`\`\`

### Transaction Propagation

\`\`\`java
@Service
public class OrderService {

    @Autowired
    private PaymentService paymentService;

    @Transactional
    public void placeOrder(Order order) {
        orderRepository.save(order);

        // REQUIRED (default): Uses existing or creates new
        paymentService.processPayment(order);

        // If paymentService throws, entire order is rolled back
    }
}

@Service
public class PaymentService {

    // REQUIRES_NEW: Always creates new transaction
    // If this fails, order can still be saved
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void processPayment(Order order) {
        // Independent transaction
    }

    // MANDATORY: Must run within existing transaction
    @Transactional(propagation = Propagation.MANDATORY)
    public void updatePaymentStatus(Order order) {
        // Throws if no transaction exists
    }
}
\`\`\`

### Common Transaction Mistakes

\`\`\`java
// ❌ BAD: Calling @Transactional method from same class
@Service
public class OrderService {

    public void processOrder(Long id) {
        updateOrder(id);  // @Transactional is IGNORED!
    }

    @Transactional
    public void updateOrder(Long id) {
        // Transaction not started because called internally
    }
}

// ✅ GOOD: Inject self or use separate service
@Service
public class OrderService {

    @Autowired
    private OrderService self;  // Or use separate service

    public void processOrder(Long id) {
        self.updateOrder(id);  // Now transaction works
    }

    @Transactional
    public void updateOrder(Long id) {
        // Transaction properly started
    }
}
\`\`\`

---

## Entity Relationships

### OneToMany / ManyToOne

\`\`\`java
// ✅ GOOD: Bidirectional with proper mapping
@Entity
public class Author {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToMany(mappedBy = "author", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Book> books = new ArrayList<>();

    // Helper methods for bidirectional sync
    public void addBook(Book book) {
        books.add(book);
        book.setAuthor(this);
    }

    public void removeBook(Book book) {
        books.remove(book);
        book.setAuthor(null);
    }
}

@Entity
public class Book {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private Author author;
}
\`\`\`

### ManyToMany

\`\`\`java
// ✅ GOOD: ManyToMany with Set (not List) to avoid duplicates
@Entity
public class Student {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
        name = "student_course",
        joinColumns = @JoinColumn(name = "student_id"),
        inverseJoinColumns = @JoinColumn(name = "course_id")
    )
    private Set<Course> courses = new HashSet<>();

    public void addCourse(Course course) {
        courses.add(course);
        course.getStudents().add(this);
    }

    public void removeCourse(Course course) {
        courses.remove(course);
        course.getStudents().remove(this);
    }
}

@Entity
public class Course {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToMany(mappedBy = "courses")
    private Set<Student> students = new HashSet<>();
}
\`\`\`

### equals() and hashCode() for Entities

\`\`\`java
// ✅ GOOD: Use business key or ID carefully
@Entity
public class Book {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NaturalId  // Hibernate annotation for business key
    @Column(unique = true, nullable = false)
    private String isbn;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Book book)) return false;
        return isbn != null && isbn.equals(book.isbn);
    }

    @Override
    public int hashCode() {
        return Objects.hash(isbn);  // Use business key, not ID
    }
}
\`\`\`

---

## Query Optimization

### Pagination

\`\`\`java
// ✅ GOOD: Always paginate large result sets
public interface OrderRepository extends JpaRepository<Order, Long> {

    Page<Order> findByStatus(OrderStatus status, Pageable pageable);

    // With sorting
    @Query("SELECT o FROM Order o WHERE o.status = :status")
    Page<Order> findByStatusSorted(
        @Param("status") OrderStatus status,
        Pageable pageable
    );
}

// Usage
Pageable pageable = PageRequest.of(0, 20, Sort.by("createdAt").descending());
Page<Order> orders = orderRepository.findByStatus(OrderStatus.PENDING, pageable);
\`\`\`

### DTO Projections

\`\`\`java
// ✅ GOOD: Fetch only needed columns

// Interface-based projection
public interface OrderSummary {
    Long getId();
    String getCustomerName();
    BigDecimal getTotal();
}

@Query("SELECT o.id as id, o.customer.name as customerName, o.total as total " +
       "FROM Order o WHERE o.status = :status")
List<OrderSummary> findOrderSummaries(@Param("status") OrderStatus status);

// Class-based projection (DTO)
public record OrderDTO(Long id, String customerName, BigDecimal total) {}

@Query("SELECT new com.example.dto.OrderDTO(o.id, o.customer.name, o.total) " +
       "FROM Order o WHERE o.status = :status")
List<OrderDTO> findOrderDTOs(@Param("status") OrderStatus status);
\`\`\`

### Bulk Operations

\`\`\`java
// ✅ GOOD: Bulk update instead of loading entities
public interface OrderRepository extends JpaRepository<Order, Long> {

    @Modifying
    @Query("UPDATE Order o SET o.status = :status WHERE o.createdAt < :date")
    int updateOldOrdersStatus(
        @Param("status") OrderStatus status,
        @Param("date") LocalDateTime date
    );

    @Modifying
    @Query("DELETE FROM Order o WHERE o.status = :status AND o.createdAt < :date")
    int deleteOldOrders(
        @Param("status") OrderStatus status,
        @Param("date") LocalDateTime date
    );
}

// Usage
@Transactional
public void archiveOldOrders() {
    LocalDateTime threshold = LocalDateTime.now().minusYears(1);
    int updated = orderRepository.updateOldOrdersStatus(
        OrderStatus.ARCHIVED,
        threshold
    );
    log.info("Archived {} orders", updated);
}
\`\`\`

---

## Optimistic Locking

### Prevent Lost Updates

\`\`\`java
// ✅ GOOD: Use @Version for optimistic locking
@Entity
public class Order {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version;

    private OrderStatus status;
    private BigDecimal total;
}

// When two users update same order:
// User 1: loads order (version=1), modifies, saves → version becomes 2
// User 2: loads order (version=1), modifies, saves → OptimisticLockException!
\`\`\`

### Handling OptimisticLockException

\`\`\`java
@Service
public class OrderService {

    @Transactional
    public Order updateOrder(Long id, UpdateOrderRequest request) {
        try {
            Order order = orderRepository.findById(id).orElseThrow();
            order.setStatus(request.getStatus());
            return orderRepository.save(order);
        } catch (OptimisticLockException e) {
            throw new ConcurrentModificationException(
                "Order was modified by another user. Please refresh and try again."
            );
        }
    }

    // Or with retry
    @Retryable(value = OptimisticLockException.class, maxAttempts = 3)
    @Transactional
    public Order updateOrderWithRetry(Long id, UpdateOrderRequest request) {
        Order order = orderRepository.findById(id).orElseThrow();
        order.setStatus(request.getStatus());
        return orderRepository.save(order);
    }
}
\`\`\`

---

## Common Mistakes

### 1. Cascade Misuse

\`\`\`java
// ❌ BAD: CascadeType.ALL on @ManyToOne
@Entity
public class Book {
    @ManyToOne(cascade = CascadeType.ALL)  // Dangerous!
    private Author author;
}
// Deleting a book could delete the author!

// ✅ GOOD: Cascade only from parent to child
@Entity
public class Author {
    @OneToMany(mappedBy = "author", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Book> books;
}
\`\`\`

### 2. Missing Index

\`\`\`java
// ❌ BAD: Frequent queries on non-indexed column
@Query("SELECT o FROM Order o WHERE o.customerEmail = :email")
List<Order> findByCustomerEmail(@Param("email") String email);

// ✅ GOOD: Add index
@Entity
@Table(indexes = @Index(name = "idx_order_customer_email", columnList = "customerEmail"))
public class Order {
    private String customerEmail;
}
\`\`\`

### 3. toString() with Lazy Fields

\`\`\`java
// ❌ BAD: toString includes lazy collection
@Entity
public class Author {
    @OneToMany(mappedBy = "author", fetch = FetchType.LAZY)
    private List<Book> books;

    @Override
    public String toString() {
        return "Author{id=" + id + ", books=" + books + "}";  // Triggers lazy load!
    }
}

// ✅ GOOD: Exclude lazy fields from toString
@Override
public String toString() {
    return "Author{id=" + id + ", name='" + name + "'}";
}
\`\`\`

---

## Performance Checklist

When reviewing JPA code, check:

- [ ] No N+1 queries (use JOIN FETCH or @EntityGraph)
- [ ] LAZY fetch by default (especially @ManyToOne)
- [ ] Pagination for large result sets
- [ ] DTO projections for read-only queries
- [ ] Bulk operations for batch updates/deletes
- [ ] @Version for entities with concurrent access
- [ ] Indexes on frequently queried columns
- [ ] No lazy fields in toString()
- [ ] Read-only transactions where applicable

---

## Related Skills

- \`spring-boot-patterns\` - Spring Boot controller/service patterns
- \`java-code-review\` - General code review checklist
- \`clean-code\` - Code quality principles`,
  },
  {
    id: 'java-logging-patterns',
    name: 'logging-patterns',
    description: 'Java logging best practices with SLF4J, structured logging (JSON), and MDC for request tracing.',
    category: 'java',
    trigger: '/java-logging',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# Logging Patterns Skill

Effective logging for Java applications with focus on structured, AI-parsable formats.

## When to Use
- User says "add logging" / "improve logs" / "debug this"
- Analyzing application flow from logs
- Setting up structured logging (JSON)
- Request tracing with correlation IDs
- AI/Claude Code needs to analyze application behavior

---

## AI-Friendly Logging

> **Key insight:** JSON logs are better for AI analysis - faster parsing, fewer tokens, direct field access.

### Why JSON for AI/Claude Code?

\`\`\`
# Text format - AI must "interpret" the string
2026-01-29 10:15:30 INFO OrderService - Order 12345 created for user-789, total: 99.99

# JSON format - AI extracts fields directly
{"timestamp":"2026-01-29T10:15:30Z","level":"INFO","orderId":12345,"userId":"user-789","total":99.99}
\`\`\`

| Aspect | Text | JSON |
|--------|------|------|
| Parsing | Regex/interpretation | Direct field access |
| Token usage | Higher (repeated patterns) | Lower (structured) |
| Error extraction | Parse stack trace text | \`exception\` field |
| Filtering | grep patterns | \`jq\` queries |

### Recommended Setup for AI-Assisted Development

\`\`\`yaml
# application.yml - JSON by default
logging:
  structured:
    format:
      console: logstash  # Spring Boot 3.4+

# When YOU need to read logs manually:
# Option 1: Use jq
# tail -f app.log | jq .

# Option 2: Switch profile temporarily
# java -jar app.jar --spring.profiles.active=human-logs
\`\`\`

### Log Format Optimized for AI Analysis

\`\`\`json
{
  "timestamp": "2026-01-29T10:15:30.123Z",
  "level": "INFO",
  "logger": "com.example.OrderService",
  "message": "Order created",
  "requestId": "req-abc123",
  "traceId": "trace-xyz",
  "orderId": 12345,
  "userId": "user-789",
  "duration_ms": 45,
  "step": "payment_completed"
}
\`\`\`

**Key fields for AI debugging:**
- \`requestId\` - group all logs from same request
- \`step\` - track progress through flow
- \`duration_ms\` - identify slow operations
- \`level\` - quick filter for errors

### Reading Logs with AI/Claude Code

When asking AI to analyze logs:

\`\`\`bash
# Get recent errors
cat app.log | jq 'select(.level == "ERROR")' | tail -20

# Follow specific request
cat app.log | jq 'select(.requestId == "req-abc123")'

# Find slow operations
cat app.log | jq 'select(.duration_ms > 1000)'
\`\`\`

AI can then:
1. Parse JSON directly (no guessing)
2. Follow request flow via requestId
3. Identify exactly where errors occurred
4. Measure timing between steps

---

## Quick Setup (Spring Boot 3.4+)

### Native Structured Logging

Spring Boot 3.4+ has built-in support - no extra dependencies!

\`\`\`yaml
# application.yml
logging:
  structured:
    format:
      console: logstash    # or "ecs" for Elastic Common Schema

# Supported formats: logstash, ecs, gelf
\`\`\`

### Profile-Based Switching

\`\`\`yaml
# application.yml (default - JSON for AI/prod)
spring:
  profiles:
    default: json-logs

---
spring:
  config:
    activate:
      on-profile: json-logs
logging:
  structured:
    format:
      console: logstash

---
spring:
  config:
    activate:
      on-profile: human-logs
# No structured format = human-readable default
logging:
  pattern:
    console: "%d{HH:mm:ss.SSS} %-5level [%thread] %logger{36} - %msg%n"
\`\`\`

**Usage:**
\`\`\`bash
# Default: JSON (for AI, CI/CD, production)
./mvnw spring-boot:run

# Human-readable when needed
./mvnw spring-boot:run -Dspring.profiles.active=human-logs
\`\`\`

---

## Setup for Spring Boot < 3.4

### Logstash Logback Encoder

**pom.xml:**
\`\`\`xml
<dependency>
    <groupId>net.logstash.logback</groupId>
    <artifactId>logstash-logback-encoder</artifactId>
    <version>7.4</version>
</dependency>
\`\`\`

**logback-spring.xml:**
\`\`\`xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>

    <!-- JSON (default) -->
    <springProfile name="!human-logs">
        <appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
            <encoder class="net.logstash.logback.encoder.LogstashEncoder">
                <includeMdcKeyName>requestId</includeMdcKeyName>
                <includeMdcKeyName>userId</includeMdcKeyName>
            </encoder>
        </appender>
        <root level="INFO">
            <appender-ref ref="JSON"/>
        </root>
    </springProfile>

    <!-- Human-readable (optional) -->
    <springProfile name="human-logs">
        <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
            <encoder>
                <pattern>%d{HH:mm:ss.SSS} %-5level [%thread] %logger{36} - %msg%n</pattern>
            </encoder>
        </appender>
        <root level="INFO">
            <appender-ref ref="CONSOLE"/>
        </root>
    </springProfile>

</configuration>
\`\`\`

### Adding Custom Fields (Logstash Encoder)

\`\`\`java
import static net.logstash.logback.argument.StructuredArguments.kv;

// Fields appear as separate JSON keys
log.info("Order created",
    kv("orderId", order.getId()),
    kv("userId", user.getId()),
    kv("total", order.getTotal()),
    kv("step", "order_created")
);

// Output:
// {"message":"Order created","orderId":123,"userId":"u-456","total":99.99,"step":"order_created"}
\`\`\`

---

## SLF4J Basics

### Logger Declaration

\`\`\`java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class OrderService {
    private static final Logger log = LoggerFactory.getLogger(OrderService.class);
}

// Or with Lombok
@Slf4j
@Service
public class OrderService {
    // use \`log\` directly
}
\`\`\`

### Parameterized Logging

\`\`\`java
// ✅ GOOD: Evaluated only if level enabled
log.debug("Processing order {} for user {}", orderId, userId);

// ❌ BAD: Always concatenates
log.debug("Processing order " + orderId + " for user " + userId);

// ✅ For expensive operations
if (log.isDebugEnabled()) {
    log.debug("Full order details: {}", order.toJson());
}
\`\`\`

---

## Log Levels

| Level | When | Example |
|-------|------|---------|
| **ERROR** | Failures needing attention | Unhandled exception, service down |
| **WARN** | Unexpected but handled | Retry succeeded, deprecated API used |
| **INFO** | Business events | Order created, payment processed |
| **DEBUG** | Technical details | Method params, SQL queries |
| **TRACE** | Very detailed | Loop iterations (rarely used) |

\`\`\`java
log.error("Payment failed", kv("orderId", id), kv("reason", reason), exception);
log.warn("Retry succeeded", kv("attempt", 3), kv("orderId", id));
log.info("Order shipped", kv("orderId", id), kv("trackingNumber", tracking));
log.debug("Fetching from DB", kv("query", "findById"), kv("id", id));
\`\`\`

---

## MDC (Mapped Diagnostic Context)

MDC adds context to every log entry in a request - essential for tracing.

### Request ID Filter

\`\`\`java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestContextFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        try {
            String requestId = Optional.ofNullable(request.getHeader("X-Request-ID"))
                .filter(s -> !s.isBlank())
                .orElse(UUID.randomUUID().toString().substring(0, 8));

            MDC.put("requestId", requestId);
            response.setHeader("X-Request-ID", requestId);

            chain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
\`\`\`

### Add User Context

\`\`\`java
// After authentication
MDC.put("userId", authentication.getName());

// All subsequent logs include userId automatically
log.info("User action performed");  // {"userId":"john123","message":"User action performed"}
\`\`\`

### MDC in Async Operations

\`\`\`java
// MDC doesn't auto-propagate to new threads!

// ✅ Copy MDC context
Map<String, String> context = MDC.getCopyOfContextMap();

CompletableFuture.runAsync(() -> {
    try {
        if (context != null) MDC.setContextMap(context);
        log.info("Async task running");  // Has requestId, userId
    } finally {
        MDC.clear();
    }
});
\`\`\`

---

## What to Log

### Business Events (INFO)

\`\`\`java
// Include key identifiers and state
log.info("Order created",
    kv("orderId", id),
    kv("userId", userId),
    kv("total", total),
    kv("itemCount", items.size()),
    kv("step", "order_created"));

log.info("Payment processed",
    kv("orderId", id),
    kv("amount", amount),
    kv("method", "card"),
    kv("step", "payment_completed"));
\`\`\`

### External Calls (with timing)

\`\`\`java
long start = System.currentTimeMillis();
try {
    Result result = externalService.call(params);
    log.info("External call succeeded",
        kv("service", "PaymentGateway"),
        kv("operation", "charge"),
        kv("duration_ms", System.currentTimeMillis() - start));
    return result;
} catch (Exception e) {
    log.error("External call failed",
        kv("service", "PaymentGateway"),
        kv("operation", "charge"),
        kv("duration_ms", System.currentTimeMillis() - start),
        e);
    throw e;
}
\`\`\`

### Flow Steps (for AI tracing)

\`\`\`java
public Order processOrder(CreateOrderRequest request) {
    log.info("Processing started", kv("step", "start"), kv("requestData", request.summary()));

    Order order = createOrder(request);
    log.info("Order created", kv("step", "order_created"), kv("orderId", order.getId()));

    validateInventory(order);
    log.info("Inventory validated", kv("step", "inventory_ok"), kv("orderId", order.getId()));

    processPayment(order);
    log.info("Payment processed", kv("step", "payment_done"), kv("orderId", order.getId()));

    log.info("Processing completed", kv("step", "complete"), kv("orderId", order.getId()));
    return order;
}
\`\`\`

---

## What NOT to Log

\`\`\`java
// ❌ NEVER log sensitive data
log.info("Login", kv("password", password));           // Passwords
log.info("Payment", kv("cardNumber", card));           // Full card numbers
log.info("Request", kv("token", jwtToken));            // Tokens
log.info("User", kv("ssn", socialSecurity));           // PII

// ✅ Safe alternatives
log.info("Login attempted", kv("userId", userId));
log.info("Payment", kv("cardLast4", last4));
log.info("Token validated", kv("subject", sub), kv("exp", expiry));
\`\`\`

---

## Exception Logging

### Log Once at Boundary

\`\`\`java
// ❌ BAD: Logs same exception multiple times
void methodA() {
    try { methodB(); }
    catch (Exception e) { log.error("Error", e); throw e; }  // Log #1
}
void methodB() {
    try { methodC(); }
    catch (Exception e) { log.error("Error", e); throw e; }  // Log #2
}

// ✅ GOOD: Log at service boundary only
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handle(Exception e, HttpServletRequest request) {
        log.error("Request failed",
            kv("path", request.getRequestURI()),
            kv("method", request.getMethod()),
            kv("errorType", e.getClass().getSimpleName()),
            e);  // Full stack trace
        return ResponseEntity.status(500).body(errorResponse);
    }
}
\`\`\`

### Include Context

\`\`\`java
// ❌ Useless
log.error("Error occurred", e);

// ✅ Useful for debugging
log.error("Order processing failed",
    kv("orderId", orderId),
    kv("step", "payment"),
    kv("userId", userId),
    kv("attemptNumber", attempt),
    e);
\`\`\`

---

## Quick Reference

\`\`\`java
// === Setup ===
private static final Logger log = LoggerFactory.getLogger(MyClass.class);

// === Logging with structured fields ===
import static net.logstash.logback.argument.StructuredArguments.kv;

log.info("Event", kv("key1", value1), kv("key2", value2));
log.error("Failed", kv("context", ctx), exception);

// === MDC ===
MDC.put("requestId", requestId);
MDC.put("userId", userId);
// ... all logs now include these
MDC.clear();  // cleanup

// === Levels ===
log.error()  // Failures
log.warn()   // Handled issues
log.info()   // Business events
log.debug()  // Technical details
\`\`\`

---

## Analyzing Logs (AI/Human)

\`\`\`bash
# Pretty print JSON logs
tail -f app.log | jq .

# Filter errors
cat app.log | jq 'select(.level == "ERROR")'

# Follow request flow
cat app.log | jq 'select(.requestId == "abc123")'

# Find slow operations (>1s)
cat app.log | jq 'select(.duration_ms > 1000)'

# Get timeline of steps
cat app.log | jq 'select(.requestId == "abc123") | {time: .timestamp, step: .step, message: .message}'
\`\`\`

---

## Related Skills

- \`spring-boot-patterns\` - Spring Boot configuration
- \`jpa-patterns\` - Database logging (SQL queries)
- Future: \`observability-patterns\` - Metrics, tracing, full observability`,
  },
  {
    id: 'java-maven-dependency-audit',
    name: 'maven-dependency-audit',
    description: 'Audit Maven dependencies for outdated versions, security vulnerabilities, and conflicts.',
    category: 'java',
    trigger: '/java-deps',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# Maven Dependency Audit Skill

Audit Maven dependencies for updates, vulnerabilities, and conflicts.

## When to Use
- User says "check dependencies" / "audit dependencies" / "outdated dependencies"
- Before a release
- Regular maintenance (monthly recommended)
- After security advisory

## Audit Workflow

1. **Check for updates** - Find outdated dependencies
2. **Analyze tree** - Find conflicts and duplicates
3. **Security scan** - Check for vulnerabilities
4. **Report** - Summary with prioritized actions

---

## 1. Check for Outdated Dependencies

### Command
\`\`\`bash
mvn versions:display-dependency-updates
\`\`\`

### Output Analysis
\`\`\`
[INFO] The following dependencies in Dependencies have newer versions:
[INFO]   org.slf4j:slf4j-api ......................... 1.7.36 -> 2.0.9
[INFO]   com.fasterxml.jackson.core:jackson-databind . 2.14.0 -> 2.16.1
[INFO]   org.junit.jupiter:junit-jupiter ............. 5.9.0 -> 5.10.1
\`\`\`

### Categorize Updates

| Category | Criteria | Action |
|----------|----------|--------|
| **Security** | CVE fix in newer version | Update ASAP |
| **Major** | x.0.0 change | Review changelog, test thoroughly |
| **Minor** | x.y.0 change | Usually safe, test |
| **Patch** | x.y.z change | Safe, minimal testing |

### Check Plugin Updates Too
\`\`\`bash
mvn versions:display-plugin-updates
\`\`\`

---

## 2. Analyze Dependency Tree

### Full Tree
\`\`\`bash
mvn dependency:tree
\`\`\`

### Filter for Specific Dependency
\`\`\`bash
mvn dependency:tree -Dincludes=org.slf4j
\`\`\`

### Find Conflicts
Look for:
\`\`\`
[INFO] +- com.example:module-a:jar:1.0:compile
[INFO] |  \\- org.slf4j:slf4j-api:jar:1.7.36:compile
[INFO] +- com.example:module-b:jar:1.0:compile
[INFO] |  \\- org.slf4j:slf4j-api:jar:2.0.9:compile (omitted for conflict)
\`\`\`

**Flags:**
- \`(omitted for conflict)\` - Version conflict resolved by Maven
- \`(omitted for duplicate)\` - Same version, no issue
- Multiple versions of same library - Potential runtime issues

### Analyze Unused Dependencies
\`\`\`bash
mvn dependency:analyze
\`\`\`

Output:
\`\`\`
[WARNING] Used undeclared dependencies found:
[WARNING]    org.slf4j:slf4j-api:jar:2.0.9:compile
[WARNING] Unused declared dependencies found:
[WARNING]    commons-io:commons-io:jar:2.11.0:compile
\`\`\`

---

## 3. Security Vulnerability Scan

### Option A: OWASP Dependency-Check (Recommended)

Add to pom.xml:
\`\`\`xml
<plugin>
    <groupId>org.owasp</groupId>
    <artifactId>dependency-check-maven</artifactId>
    <version>9.0.7</version>
</plugin>
\`\`\`

Run:
\`\`\`bash
mvn dependency-check:check
\`\`\`

Output: HTML report in \`target/dependency-check-report.html\`

### Option B: Maven Dependency Plugin
\`\`\`bash
mvn dependency:analyze-report
\`\`\`

### Option C: GitHub Dependabot
If using GitHub, enable Dependabot alerts in repository settings.

### Severity Levels

| CVSS Score | Severity | Action |
|------------|----------|--------|
| 9.0 - 10.0 | Critical | Update immediately |
| 7.0 - 8.9 | High | Update within days |
| 4.0 - 6.9 | Medium | Update within weeks |
| 0.1 - 3.9 | Low | Update at convenience |

---

## 4. Generate Audit Report

### Output Format

\`\`\`markdown
## Dependency Audit Report

**Project:** {project-name}
**Date:** {date}
**Total Dependencies:** {count}

### Security Issues

| Dependency | Current | CVE | Severity | Fixed In |
|------------|---------|-----|----------|----------|
| log4j-core | 2.14.0 | CVE-2021-44228 | Critical | 2.17.1 |

### Outdated Dependencies

#### Major Updates (Review Required)
| Dependency | Current | Latest | Notes |
|------------|---------|--------|-------|
| slf4j-api | 1.7.36 | 2.0.9 | API changes, see migration guide |

#### Minor/Patch Updates (Safe)
| Dependency | Current | Latest |
|------------|---------|--------|
| junit-jupiter | 5.9.0 | 5.10.1 |
| jackson-databind | 2.14.0 | 2.16.1 |

### Conflicts Detected
- slf4j-api: 1.7.36 vs 2.0.9 (resolved to 2.0.9)

### Unused Dependencies
- commons-io:commons-io:2.11.0 (consider removing)

### Recommendations
1. **Immediate:** Update log4j-core to fix CVE-2021-44228
2. **This sprint:** Update minor/patch versions
3. **Plan:** Evaluate slf4j 2.x migration
\`\`\`

---

## Common Scenarios

### Scenario: Check Before Release
\`\`\`bash
# Quick check
mvn versions:display-dependency-updates -q

# Full audit
mvn versions:display-dependency-updates && \\
mvn dependency:analyze && \\
mvn dependency-check:check
\`\`\`

### Scenario: Find Why Dependency is Included
\`\`\`bash
mvn dependency:tree -Dincludes=commons-logging
\`\`\`

### Scenario: Force Specific Version (Resolve Conflict)
\`\`\`xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-api</artifactId>
            <version>2.0.9</version>
        </dependency>
    </dependencies>
</dependencyManagement>
\`\`\`

### Scenario: Exclude Transitive Dependency
\`\`\`xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>some-library</artifactId>
    <version>1.0</version>
    <exclusions>
        <exclusion>
            <groupId>commons-logging</groupId>
            <artifactId>commons-logging</artifactId>
        </exclusion>
    </exclusions>
</dependency>
\`\`\`

---

## Token Optimization

- Use \`-q\` (quiet) flag for less verbose output
- Filter with \`-Dincludes=groupId:artifactId\` when looking for specific deps
- Run commands separately and summarize findings
- Don't paste entire dependency tree - summarize conflicts

## Quick Commands Reference

| Task | Command |
|------|---------|
| Outdated deps | \`mvn versions:display-dependency-updates\` |
| Outdated plugins | \`mvn versions:display-plugin-updates\` |
| Dependency tree | \`mvn dependency:tree\` |
| Find specific dep | \`mvn dependency:tree -Dincludes=groupId\` |
| Unused deps | \`mvn dependency:analyze\` |
| Security scan | \`mvn dependency-check:check\` |
| Update versions | \`mvn versions:use-latest-releases\` |
| Update snapshots | \`mvn versions:use-latest-snapshots\` |

## Update Strategies

### Conservative (Recommended for Production)
1. Update patch versions freely
2. Update minor versions with basic testing
3. Major versions require migration plan

### Aggressive (For Active Development)
\`\`\`bash
# Update all to latest (use with caution!)
mvn versions:use-latest-releases
mvn versions:commit  # or versions:revert
\`\`\`

### Selective
\`\`\`bash
# Update specific dependency
mvn versions:use-latest-versions -Dincludes=org.junit.jupiter
\`\`\``,
  },
  {
    id: 'java-performance-smell-detection',
    name: 'performance-smell-detection',
    description: 'Detect performance smells in Java: streams, collections, boxing, regex, object creation.',
    category: 'java',
    trigger: '/java-perf',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# Performance Smell Detection Skill

Identify **potential** code-level performance issues in Java code.

## Philosophy

> "Premature optimization is the root of all evil" - Donald Knuth

This skill helps you **notice** potential performance smells, not blindly "fix" them. Modern JVMs (Java 21/25) are highly optimized. Always:

1. **Measure first** - Use JMH, profilers, or production metrics
2. **Focus on hot paths** - 90% of time spent in 10% of code
3. **Consider readability** - Clear code often matters more than micro-optimizations

## When to Use
- Reviewing performance-critical code paths
- Investigating measured performance issues
- Learning about Java performance patterns
- Code review with performance awareness

## Scope

**This skill:** Code-level performance (streams, collections, objects)
**For database:** Use \`jpa-patterns\` skill (N+1, lazy loading, pagination)
**For architecture:** Use \`architecture-review\` skill

---

## Quick Reference: Potential Smells

| Smell | Severity | Context |
|-------|----------|---------|
| Regex compile in loop | 🔴 High | Always worth fixing |
| String concat in loop | 🟡 Medium | Still valid in Java 21/25 |
| Stream in tight loop | 🟡 Medium | Depends on collection size |
| Boxing in hot path | 🟡 Medium | Measure first |
| Unbounded collection | 🔴 High | Memory risk |
| Missing collection capacity | 🟢 Low | Minor, measure if critical |

---

## String Operations (Java 9+ / 21 / 25)

### What Changed

Since **Java 9** (JEP 280), string concatenation with \`+\` uses \`invokedynamic\`, not StringBuilder. The JVM optimizes simple concatenation well.

**Java 25** adds String::hashCode constant folding for additional optimization in Map lookups with String keys.

### Still Valid: StringBuilder in Loops

\`\`\`java
// 🔴 Still problematic - new String each iteration
String result = "";
for (String s : items) {
    result += s;  // O(n²) - creates n strings
}

// ✅ StringBuilder for loops
StringBuilder sb = new StringBuilder();
for (String s : items) {
    sb.append(s);
}
String result = sb.toString();

// ✅ Or use String.join / Collectors.joining
String result = String.join("", items);
\`\`\`

### Now Fine: Simple Concatenation

\`\`\`java
// ✅ Fine in Java 9+ - JVM optimizes this
String message = "User " + name + " logged in at " + timestamp;

// ✅ Also fine
return "Error: " + code + " - " + description;
\`\`\`

### Avoid in Hot Paths: String.format

\`\`\`java
// 🟡 String.format has parsing overhead
log.debug(String.format("Processing %s with id %d", name, id));

// ✅ Parameterized logging (SLF4J)
log.debug("Processing {} with id {}", name, id);
\`\`\`

---

## Stream API (Nuanced View)

### The Reality

Streams have overhead, but it's **often acceptable**:
- **< 100 items**: Streams can be 2-5x slower (but still microseconds)
- **1K-10K items**: Difference narrows significantly
- **> 10K items**: Often within 50% of loops
- **GraalVM**: Can optimize streams to match loops

**Recommendation**: Prefer streams for readability. Optimize to loops only when profiling shows a bottleneck.

### When Streams Are Problematic

\`\`\`java
// 🔴 Stream created per iteration in hot loop
for (int i = 0; i < 1_000_000; i++) {
    boolean found = items.stream()
        .anyMatch(item -> item.getId() == i);
}

// ✅ Pre-compute lookup structure
Set<Integer> itemIds = items.stream()
    .map(Item::getId)
    .collect(Collectors.toSet());

for (int i = 0; i < 1_000_000; i++) {
    boolean found = itemIds.contains(i);
}
\`\`\`

### When Streams Are Fine

\`\`\`java
// ✅ Single pass, readable, not in tight loop
List<String> names = users.stream()
    .filter(User::isActive)
    .map(User::getName)
    .sorted()
    .collect(Collectors.toList());

// ✅ Primitive streams avoid boxing
int sum = numbers.stream()
    .mapToInt(Integer::intValue)
    .sum();
\`\`\`

### Parallel Streams: Use Carefully

\`\`\`java
// 🔴 Parallel on small collection - overhead > benefit
smallList.parallelStream().map(...);  // < 10K items

// 🔴 Parallel with shared mutable state
List<String> results = new ArrayList<>();
items.parallelStream()
    .forEach(results::add);  // Race condition!

// ✅ Parallel for CPU-intensive + large collections
List<Result> results = largeDataset.parallelStream()  // > 10K items
    .map(this::expensiveCpuComputation)
    .collect(Collectors.toList());
\`\`\`

---

## Boxing/Unboxing

### Still a Real Issue

Boxing creates objects on heap, adds GC pressure. JVM caches small values (-128 to 127) but not larger ones.

> **Future**: Project Valhalla will improve this significantly.

\`\`\`java
// 🔴 Boxing in tight loop - creates millions of objects
Long sum = 0L;
for (int i = 0; i < 1_000_000; i++) {
    sum += i;  // Unbox, add, box
}

// ✅ Primitive
long sum = 0L;
for (int i = 0; i < 1_000_000; i++) {
    sum += i;
}
\`\`\`

### Use Primitive Streams

\`\`\`java
// 🟡 Boxing overhead
int sum = list.stream()
    .reduce(0, Integer::sum);

// ✅ Primitive stream
int sum = list.stream()
    .mapToInt(Integer::intValue)
    .sum();
\`\`\`

---

## Regex

### Always Pre-compile in Loops

This advice is **not outdated** - Pattern.compile is expensive.

\`\`\`java
// 🔴 Compiles pattern every iteration
for (String input : inputs) {
    if (input.matches("\\\\d{3}-\\\\d{4}")) {  // Compiles regex!
        process(input);
    }
}

// ✅ Pre-compile
private static final Pattern PHONE = Pattern.compile("\\\\d{3}-\\\\d{4}");

for (String input : inputs) {
    if (PHONE.matcher(input).matches()) {
        process(input);
    }
}
\`\`\`

---

## Collections

### Capacity Hint (Minor Optimization)

\`\`\`java
// 🟢 Low severity - but free optimization if size known
List<User> users = new ArrayList<>(expectedSize);
Map<String, User> map = new HashMap<>(expectedSize * 4 / 3 + 1);
\`\`\`

### Right Collection for the Job

\`\`\`java
// 🟡 O(n) lookup in loop
List<String> allowed = getAllowed();
for (Request r : requests) {
    if (allowed.contains(r.getId())) { }  // O(n) each time
}

// ✅ O(1) lookup
Set<String> allowed = new HashSet<>(getAllowed());
for (Request r : requests) {
    if (allowed.contains(r.getId())) { }  // O(1)
}
\`\`\`

### Unbounded Collections

\`\`\`java
// 🔴 Memory risk - could grow unbounded
@GetMapping("/users")
public List<User> getAllUsers() {
    return userRepository.findAll();  // Millions of rows?
}

// ✅ Pagination
@GetMapping("/users")
public Page<User> getUsers(Pageable pageable) {
    return userRepository.findAll(pageable);
}
\`\`\`

---

## Modern Java (21/25) Patterns

### Virtual Threads for I/O (Java 21+)

\`\`\`java
// 🟡 Traditional thread pool for I/O - wastes OS threads
ExecutorService executor = Executors.newFixedThreadPool(100);
for (Request request : requests) {
    executor.submit(() -> callExternalApi(request));  // Blocks OS thread
}

// ✅ Virtual threads - millions of concurrent I/O operations
try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (Request request : requests) {
        executor.submit(() -> callExternalApi(request));
    }
}
\`\`\`

### Structured Concurrency (Java 21+ Preview)

\`\`\`java
// ✅ Structured concurrency for parallel I/O
try (StructuredTaskScope.ShutdownOnFailure scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Future<User> user = scope.fork(() -> fetchUser(id));
    Future<Orders> orders = scope.fork(() -> fetchOrders(id));

    scope.join();
    scope.throwIfFailed();

    return new UserProfile(user.resultNow(), orders.resultNow());
}
\`\`\`

---

## Performance Review Checklist

### 🔴 High Severity (Usually Worth Fixing)
- [ ] Regex Pattern.compile in loops
- [ ] Unbounded queries without pagination
- [ ] String concatenation in loops (StringBuilder still valid)
- [ ] Parallel streams with shared mutable state

### 🟡 Medium Severity (Measure First)
- [ ] Streams in tight loops (>100K iterations)
- [ ] Boxing in hot paths
- [ ] List.contains() in loops (use Set)
- [ ] Traditional threads for I/O (consider Virtual Threads)

### 🟢 Low Severity (Nice to Have)
- [ ] Collection initial capacity
- [ ] Minor stream optimizations
- [ ] toArray(new T[0]) vs toArray(new T[size])

---

## When NOT to Optimize

- **Not a hot path** - Setup code, config, admin endpoints
- **No measured problem** - "Looks slow" is not a measurement
- **Readability suffers** - Clear code > micro-optimization
- **Small collections** - 100 items processed in microseconds anyway

---

## Analysis Commands

\`\`\`bash
# Find regex in loops (potential compile overhead)
grep -rn "\\.matches(\\|\\.split(" --include="*.java"

# Find potential boxing (Long/Integer as variables)
grep -rn "Long\\s\\|Integer\\s\\|Double\\s" --include="*.java" | grep "= 0\\|+="

# Find ArrayList without capacity
grep -rn "new ArrayList<>()" --include="*.java"

# Find findAll without pagination
grep -rn "findAll()" --include="*.java"
\`\`\``,
  },
  {
    id: 'java-security-audit',
    name: 'security-audit',
    description: 'Java security checklist: OWASP Top 10, input validation, injection prevention, secure coding with Spring.',
    category: 'java',
    trigger: '/java-security',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# Security Audit Skill

Security checklist for Java applications based on OWASP Top 10 and secure coding practices.

## When to Use
- Security code review
- Before production releases
- User asks about "security", "vulnerability", "OWASP"
- Reviewing authentication/authorization code
- Checking for injection vulnerabilities

---

## OWASP Top 10 Quick Reference

| # | Risk | Java Mitigation |
|---|------|-----------------|
| A01 | Broken Access Control | Role-based checks, deny by default |
| A02 | Cryptographic Failures | Use strong algorithms, no hardcoded secrets |
| A03 | Injection | Parameterized queries, input validation |
| A04 | Insecure Design | Threat modeling, secure defaults |
| A05 | Security Misconfiguration | Disable debug, secure headers |
| A06 | Vulnerable Components | Dependency scanning, updates |
| A07 | Authentication Failures | Strong passwords, MFA, session management |
| A08 | Data Integrity Failures | Verify signatures, secure deserialization |
| A09 | Logging Failures | Log security events, no sensitive data |
| A10 | SSRF | Validate URLs, allowlist domains |

---

## Input Validation (All Frameworks)

### Bean Validation (JSR 380)

Works in Spring, Quarkus, Jakarta EE, and standalone.

\`\`\`java
// ✅ GOOD: Validate at boundary
public class CreateUserRequest {

    @NotNull(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be 3-50 characters")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "Username can only contain letters, numbers, underscore")
    private String username;

    @NotNull
    @Email(message = "Invalid email format")
    private String email;

    @NotNull
    @Size(min = 8, max = 100)
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\\\d).*$",
             message = "Password must contain uppercase, lowercase, and number")
    private String password;

    @Min(value = 0, message = "Age cannot be negative")
    @Max(value = 150, message = "Invalid age")
    private Integer age;
}

// Controller/Resource - trigger validation
public Response createUser(@Valid CreateUserRequest request) {
    // request is already validated
}
\`\`\`

### Custom Validators

\`\`\`java
// Custom annotation
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = SafeHtmlValidator.class)
public @interface SafeHtml {
    String message() default "Contains unsafe HTML";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

// Validator implementation
public class SafeHtmlValidator implements ConstraintValidator<SafeHtml, String> {

    private static final Pattern DANGEROUS_PATTERN = Pattern.compile(
        "<script|javascript:|on\\\\w+\\\\s*=", Pattern.CASE_INSENSITIVE
    );

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) return true;
        return !DANGEROUS_PATTERN.matcher(value).find();
    }
}
\`\`\`

### Allowlist vs Blocklist

\`\`\`java
// ❌ BAD: Blocklist (attackers find bypasses)
if (input.contains("<script>")) {
    throw new ValidationException("Invalid input");
}

// ✅ GOOD: Allowlist (only permit known-good)
private static final Pattern SAFE_NAME = Pattern.compile("^[a-zA-Z\\\\s'-]{1,100}$");

if (!SAFE_NAME.matcher(input).matches()) {
    throw new ValidationException("Invalid name format");
}
\`\`\`

---

## SQL Injection Prevention

### JPA/Hibernate (All Frameworks)

\`\`\`java
// ✅ GOOD: Parameterized queries
@Query("SELECT u FROM User u WHERE u.email = :email")
Optional<User> findByEmail(@Param("email") String email);

// ✅ GOOD: Criteria API
CriteriaBuilder cb = entityManager.getCriteriaBuilder();
CriteriaQuery<User> query = cb.createQuery(User.class);
Root<User> user = query.from(User.class);
query.where(cb.equal(user.get("email"), email));  // Safe

// ✅ GOOD: Named parameters
TypedQuery<User> query = entityManager.createQuery(
    "SELECT u FROM User u WHERE u.status = :status", User.class);
query.setParameter("status", status);  // Safe

// ❌ BAD: String concatenation
String jpql = "SELECT u FROM User u WHERE u.email = '" + email + "'";  // VULNERABLE!
\`\`\`

### Native Queries

\`\`\`java
// ✅ GOOD: Parameterized native query
@Query(value = "SELECT * FROM users WHERE email = ?1", nativeQuery = true)
User findByEmailNative(String email);

// ❌ BAD: Concatenated native query
String sql = "SELECT * FROM users WHERE email = '" + email + "'";  // VULNERABLE!
\`\`\`

### JDBC (Plain Java)

\`\`\`java
// ✅ GOOD: PreparedStatement
String sql = "SELECT * FROM users WHERE email = ? AND status = ?";
try (PreparedStatement stmt = connection.prepareStatement(sql)) {
    stmt.setString(1, email);
    stmt.setString(2, status);
    ResultSet rs = stmt.executeQuery();
}

// ❌ BAD: Statement with concatenation
String sql = "SELECT * FROM users WHERE email = '" + email + "'";  // VULNERABLE!
Statement stmt = connection.createStatement();
stmt.executeQuery(sql);
\`\`\`

---

## XSS Prevention

### Output Encoding

\`\`\`java
// ✅ GOOD: Use templating engine's auto-escaping

// Thymeleaf - auto-escapes by default
<p th:text="\${userInput}">...</p>  // Safe

// To display HTML (dangerous, use carefully):
<p th:utext="\${trustedHtml}">...</p>  // Only for trusted content!

// ✅ GOOD: Manual encoding when needed
import org.owasp.encoder.Encode;

String safe = Encode.forHtml(userInput);
String safeJs = Encode.forJavaScript(userInput);
String safeUrl = Encode.forUriComponent(userInput);
\`\`\`

**Maven dependency for OWASP Encoder:**
\`\`\`xml
<dependency>
    <groupId>org.owasp.encoder</groupId>
    <artifactId>encoder</artifactId>
    <version>1.2.3</version>
</dependency>
\`\`\`

### Content Security Policy

\`\`\`java
// Add CSP header to prevent inline scripts

// Spring Boot
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.headers(headers -> headers
            .contentSecurityPolicy(csp -> csp
                .policyDirectives("default-src 'self'; script-src 'self'; style-src 'self'")
            )
        );
        return http.build();
    }
}

// Servlet Filter (works everywhere)
@WebFilter("/*")
public class SecurityHeadersFilter implements Filter {
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletResponse response = (HttpServletResponse) res;
        response.setHeader("Content-Security-Policy", "default-src 'self'");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("X-XSS-Protection", "1; mode=block");
        chain.doFilter(req, res);
    }
}
\`\`\`

---

## CSRF Protection

### Spring Security

\`\`\`java
// CSRF enabled by default for browser clients
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // For REST APIs with JWT (stateless) - can disable CSRF
            .csrf(csrf -> csrf.disable())

            // For browser apps with sessions - keep CSRF enabled
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
            );
        return http.build();
    }
}
\`\`\`

### Quarkus

\`\`\`properties
# application.properties
quarkus.http.csrf.enabled=true
quarkus.http.csrf.cookie-name=XSRF-TOKEN
\`\`\`

---

## Authentication & Authorization

### Password Storage

\`\`\`java
// ✅ GOOD: Use BCrypt or Argon2
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;

// BCrypt (widely supported)
PasswordEncoder encoder = new BCryptPasswordEncoder(12);  // strength 12
String hash = encoder.encode(rawPassword);
boolean matches = encoder.matches(rawPassword, hash);

// Argon2 (recommended for new projects)
PasswordEncoder encoder = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
String hash = encoder.encode(rawPassword);

// ❌ BAD: MD5, SHA1, SHA256 without salt
String hash = DigestUtils.md5Hex(password);  // NEVER for passwords!
\`\`\`

### Authorization Checks

\`\`\`java
// ✅ GOOD: Check authorization at service layer
@Service
public class DocumentService {

    public Document getDocument(Long documentId, User currentUser) {
        Document doc = documentRepository.findById(documentId)
            .orElseThrow(() -> new NotFoundException("Document not found"));

        // Authorization check
        if (!doc.getOwnerId().equals(currentUser.getId()) &&
            !currentUser.hasRole("ADMIN")) {
            throw new AccessDeniedException("Not authorized to access this document");
        }

        return doc;
    }
}

// ❌ BAD: Only check at controller level, trust user input
@GetMapping("/documents/{id}")
public Document getDocument(@PathVariable Long id) {
    return documentRepository.findById(id).orElseThrow();  // No auth check!
}
\`\`\`

### Spring Security Annotations

\`\`\`java
@PreAuthorize("hasRole('ADMIN')")
public void adminOnly() { }

@PreAuthorize("hasRole('USER') and #userId == authentication.principal.id")
public void ownDataOnly(Long userId) { }

@PreAuthorize("@authService.canAccess(#documentId, authentication)")
public Document getDocument(Long documentId) { }
\`\`\`

---

## Secrets Management

### Never Hardcode Secrets

\`\`\`java
// ❌ BAD: Hardcoded secrets
private static final String API_KEY = "sk-1234567890abcdef";
private static final String DB_PASSWORD = "admin123";

// ✅ GOOD: Environment variables
String apiKey = System.getenv("API_KEY");

// ✅ GOOD: External configuration
@Value("\${api.key}")
private String apiKey;

// ✅ GOOD: Secrets manager
@Autowired
private SecretsManager secretsManager;
String apiKey = secretsManager.getSecret("api-key");
\`\`\`

### Configuration Files

\`\`\`yaml
# ✅ GOOD: Reference environment variables
spring:
  datasource:
    password: \${DB_PASSWORD}

api:
  key: \${API_KEY}

# ❌ BAD: Hardcoded in application.yml
spring:
  datasource:
    password: admin123  # NEVER!
\`\`\`

### .gitignore

\`\`\`gitignore
# Never commit these
.env
*.pem
*.key
*credentials*
*secret*
application-local.yml
\`\`\`

---

## Secure Deserialization

### Avoid Java Serialization

\`\`\`java
// ❌ DANGEROUS: Java ObjectInputStream
ObjectInputStream ois = new ObjectInputStream(untrustedInput);
Object obj = ois.readObject();  // Remote Code Execution risk!

// ✅ GOOD: Use JSON with Jackson
ObjectMapper mapper = new ObjectMapper();
// Disable dangerous features
mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
mapper.activateDefaultTyping(
    LaissezFaireSubTypeValidator.instance,
    ObjectMapper.DefaultTyping.NON_FINAL
);  // Be careful with polymorphic types!

User user = mapper.readValue(json, User.class);
\`\`\`

### Jackson Security

\`\`\`java
// ✅ Configure Jackson safely
@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();

        // Prevent unknown properties exploitation
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        // Don't allow class type in JSON (prevents gadget attacks)
        mapper.deactivateDefaultTyping();

        return mapper;
    }
}
\`\`\`

---

## Dependency Security

### OWASP Dependency Check

**Maven:**
\`\`\`xml
<plugin>
    <groupId>org.owasp</groupId>
    <artifactId>dependency-check-maven</artifactId>
    <version>9.0.7</version>
    <executions>
        <execution>
            <goals>
                <goal>check</goal>
            </goals>
        </execution>
    </executions>
    <configuration>
        <failBuildOnCVSS>7</failBuildOnCVSS>  <!-- Fail on high severity -->
    </configuration>
</plugin>
\`\`\`

**Run:**
\`\`\`bash
mvn dependency-check:check
# Report: target/dependency-check-report.html
\`\`\`

### Keep Dependencies Updated

\`\`\`bash
# Check for updates
mvn versions:display-dependency-updates

# Update to latest
mvn versions:use-latest-releases
\`\`\`

---

## Security Headers

### Recommended Headers

| Header | Value | Purpose |
|--------|-------|---------|
| \`Content-Security-Policy\` | \`default-src 'self'\` | Prevent XSS |
| \`X-Content-Type-Options\` | \`nosniff\` | Prevent MIME sniffing |
| \`X-Frame-Options\` | \`DENY\` | Prevent clickjacking |
| \`Strict-Transport-Security\` | \`max-age=31536000\` | Force HTTPS |
| \`X-XSS-Protection\` | \`1; mode=block\` | Legacy XSS filter |

### Spring Boot Configuration

\`\`\`java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.headers(headers -> headers
        .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'"))
        .frameOptions(frame -> frame.deny())
        .httpStrictTransportSecurity(hsts -> hsts.maxAgeInSeconds(31536000))
        .contentTypeOptions(Customizer.withDefaults())
    );
    return http.build();
}
\`\`\`

---

## Logging Security Events

\`\`\`java
// ✅ Log security-relevant events
log.info("User login successful", kv("userId", userId), kv("ip", clientIp));
log.warn("Failed login attempt", kv("username", username), kv("ip", clientIp), kv("attempt", attemptCount));
log.warn("Access denied", kv("userId", userId), kv("resource", resourceId), kv("action", action));
log.error("Authentication failure", kv("reason", reason), kv("ip", clientIp));

// ❌ NEVER log sensitive data
log.info("Login: user={}, password={}", username, password);  // NEVER!
log.debug("Request body: {}", requestWithCreditCard);  // NEVER!
\`\`\`

---

## Security Checklist

### Code Review

- [ ] Input validated with allowlist patterns
- [ ] SQL queries use parameters (no concatenation)
- [ ] Output encoded for context (HTML, JS, URL)
- [ ] Authorization checked at service layer
- [ ] No hardcoded secrets
- [ ] Passwords hashed with BCrypt/Argon2
- [ ] Sensitive data not logged
- [ ] CSRF protection enabled (for browser apps)

### Configuration

- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Debug/dev features disabled in production
- [ ] Default credentials changed
- [ ] Error messages don't leak internal details

### Dependencies

- [ ] No known vulnerabilities (OWASP check)
- [ ] Dependencies up to date
- [ ] Unnecessary dependencies removed

---

## Related Skills

- \`java-code-review\` - General code review
- \`maven-dependency-audit\` - Dependency vulnerability scanning
- \`logging-patterns\` - Secure logging practices`,
  },
  {
    id: 'java-solid-principles',
    name: 'solid-principles',
    description: 'SOLID principles checklist with Java examples and refactoring suggestions.',
    category: 'java',
    trigger: '/java-solid',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# SOLID Principles Skill

Review and apply SOLID principles in Java code.

## When to Use
- User says "check SOLID" / "SOLID review" / "is this class doing too much?"
- Reviewing class design
- Refactoring large classes
- Code review focusing on design

---

## Quick Reference

| Letter | Principle | One-liner |
|--------|-----------|-----------|
| **S** | Single Responsibility | One class = one reason to change |
| **O** | Open/Closed | Open for extension, closed for modification |
| **L** | Liskov Substitution | Subtypes must be substitutable for base types |
| **I** | Interface Segregation | Many specific interfaces > one general interface |
| **D** | Dependency Inversion | Depend on abstractions, not concretions |

---

## S - Single Responsibility Principle (SRP)

> "A class should have only one reason to change."

### Violation

\`\`\`java
// ❌ BAD: UserService does too much
public class UserService {

    public User createUser(String name, String email) {
        // validation logic
        if (email == null || !email.contains("@")) {
            throw new IllegalArgumentException("Invalid email");
        }

        // persistence logic
        User user = new User(name, email);
        entityManager.persist(user);

        // notification logic
        String subject = "Welcome!";
        String body = "Hello " + name;
        emailClient.send(email, subject, body);

        // audit logic
        auditLog.log("User created: " + email);

        return user;
    }
}
\`\`\`

**Problems:**
- Validation changes? Modify UserService
- Email template changes? Modify UserService
- Audit format changes? Modify UserService
- Hard to test each concern separately

### Refactored

\`\`\`java
// ✅ GOOD: Each class has one responsibility

public class UserValidator {
    public void validate(String name, String email) {
        if (email == null || !email.contains("@")) {
            throw new ValidationException("Invalid email");
        }
    }
}

public class UserRepository {
    public User save(User user) {
        entityManager.persist(user);
        return user;
    }
}

public class WelcomeEmailSender {
    public void sendWelcome(User user) {
        String subject = "Welcome!";
        String body = "Hello " + user.getName();
        emailClient.send(user.getEmail(), subject, body);
    }
}

public class UserAuditLogger {
    public void logCreation(User user) {
        auditLog.log("User created: " + user.getEmail());
    }
}

public class UserService {
    private final UserValidator validator;
    private final UserRepository repository;
    private final WelcomeEmailSender emailSender;
    private final UserAuditLogger auditLogger;

    public User createUser(String name, String email) {
        validator.validate(name, email);
        User user = repository.save(new User(name, email));
        emailSender.sendWelcome(user);
        auditLogger.logCreation(user);
        return user;
    }
}
\`\`\`

### How to Detect SRP Violations

- Class has many \`import\` statements from different domains
- Class name contains "And" or "Manager" or "Handler" (often)
- Methods operate on unrelated data
- Changes in one area require touching unrelated methods
- Hard to name the class concisely

### Quick Check Questions

1. Can you describe the class purpose in one sentence without "and"?
2. Would different stakeholders request changes to this class?
3. Are there methods that don't use most of the class fields?

---

## O - Open/Closed Principle (OCP)

> "Software entities should be open for extension, but closed for modification."

### Violation

\`\`\`java
// ❌ BAD: Must modify class to add new discount type
public class DiscountCalculator {

    public double calculate(Order order, String discountType) {
        if (discountType.equals("PERCENTAGE")) {
            return order.getTotal() * 0.1;
        } else if (discountType.equals("FIXED")) {
            return 50.0;
        } else if (discountType.equals("LOYALTY")) {
            return order.getTotal() * order.getCustomer().getLoyaltyRate();
        }
        // Every new discount type = modify this class
        return 0;
    }
}
\`\`\`

### Refactored

\`\`\`java
// ✅ GOOD: Add new discounts without modifying existing code

public interface DiscountStrategy {
    double calculate(Order order);
    boolean supports(String discountType);
}

public class PercentageDiscount implements DiscountStrategy {
    @Override
    public double calculate(Order order) {
        return order.getTotal() * 0.1;
    }

    @Override
    public boolean supports(String discountType) {
        return "PERCENTAGE".equals(discountType);
    }
}

public class FixedDiscount implements DiscountStrategy {
    @Override
    public double calculate(Order order) {
        return 50.0;
    }

    @Override
    public boolean supports(String discountType) {
        return "FIXED".equals(discountType);
    }
}

public class LoyaltyDiscount implements DiscountStrategy {
    @Override
    public double calculate(Order order) {
        return order.getTotal() * order.getCustomer().getLoyaltyRate();
    }

    @Override
    public boolean supports(String discountType) {
        return "LOYALTY".equals(discountType);
    }
}

// New discount? Just add new class, no modification needed
public class SeasonalDiscount implements DiscountStrategy {
    @Override
    public double calculate(Order order) {
        return order.getTotal() * 0.2;
    }

    @Override
    public boolean supports(String discountType) {
        return "SEASONAL".equals(discountType);
    }
}

public class DiscountCalculator {
    private final List<DiscountStrategy> strategies;

    public DiscountCalculator(List<DiscountStrategy> strategies) {
        this.strategies = strategies;
    }

    public double calculate(Order order, String discountType) {
        return strategies.stream()
            .filter(s -> s.supports(discountType))
            .findFirst()
            .map(s -> s.calculate(order))
            .orElse(0.0);
    }
}
\`\`\`

### How to Detect OCP Violations

- \`if/else\` or \`switch\` on type/status that grows over time
- Enum-based dispatching with frequent new values
- Changes require modifying core classes

### Common OCP Patterns

| Pattern | Use When |
|---------|----------|
| Strategy | Multiple algorithms for same operation |
| Template Method | Same structure, different steps |
| Decorator | Add behavior dynamically |
| Factory | Create objects without specifying class |

---

## L - Liskov Substitution Principle (LSP)

> "Subtypes must be substitutable for their base types."

### Violation

\`\`\`java
// ❌ BAD: Square violates Rectangle contract
public class Rectangle {
    protected int width;
    protected int height;

    public void setWidth(int width) {
        this.width = width;
    }

    public void setHeight(int height) {
        this.height = height;
    }

    public int getArea() {
        return width * height;
    }
}

public class Square extends Rectangle {
    @Override
    public void setWidth(int width) {
        this.width = width;
        this.height = width;  // Violates expected behavior!
    }

    @Override
    public void setHeight(int height) {
        this.width = height;  // Violates expected behavior!
        this.height = height;
    }
}

// This test fails for Square!
void testRectangle(Rectangle r) {
    r.setWidth(5);
    r.setHeight(4);
    assert r.getArea() == 20;  // Square returns 16!
}
\`\`\`

### Refactored

\`\`\`java
// ✅ GOOD: Separate abstractions

public interface Shape {
    int getArea();
}

public class Rectangle implements Shape {
    private final int width;
    private final int height;

    public Rectangle(int width, int height) {
        this.width = width;
        this.height = height;
    }

    @Override
    public int getArea() {
        return width * height;
    }
}

public class Square implements Shape {
    private final int side;

    public Square(int side) {
        this.side = side;
    }

    @Override
    public int getArea() {
        return side * side;
    }
}
\`\`\`

### LSP Rules

| Rule | Meaning |
|------|---------|
| Preconditions | Subclass cannot strengthen (require more) |
| Postconditions | Subclass cannot weaken (promise less) |
| Invariants | Subclass must maintain parent's invariants |
| History | Subclass cannot modify inherited state unexpectedly |

### How to Detect LSP Violations

- Subclass throws exception parent doesn't
- Subclass returns null where parent returns object
- Subclass ignores or overrides parent behavior unexpectedly
- \`instanceof\` checks before calling methods
- Empty or throwing implementations of interface methods

### Quick Check

\`\`\`java
// If you see this, LSP might be violated
if (bird instanceof Penguin) {
    // don't call fly()
} else {
    bird.fly();
}
\`\`\`

---

## I - Interface Segregation Principle (ISP)

> "Clients should not be forced to depend on interfaces they do not use."

### Violation

\`\`\`java
// ❌ BAD: Fat interface forces unnecessary implementations
public interface Worker {
    void work();
    void eat();
    void sleep();
    void attendMeeting();
    void writeReport();
}

// Robot can't eat or sleep!
public class Robot implements Worker {
    @Override public void work() { /* OK */ }
    @Override public void eat() { /* Can't eat! */ }
    @Override public void sleep() { /* Can't sleep! */ }
    @Override public void attendMeeting() { /* OK */ }
    @Override public void writeReport() { /* Maybe */ }
}

// Intern doesn't attend meetings or write reports
public class Intern implements Worker {
    @Override public void work() { /* OK */ }
    @Override public void eat() { /* OK */ }
    @Override public void sleep() { /* OK */ }
    @Override public void attendMeeting() { /* Not allowed! */ }
    @Override public void writeReport() { /* Not expected! */ }
}
\`\`\`

### Refactored

\`\`\`java
// ✅ GOOD: Segregated interfaces

public interface Workable {
    void work();
}

public interface Feedable {
    void eat();
    void sleep();
}

public interface Manageable {
    void attendMeeting();
    void writeReport();
}

// Combine what you need
public class Employee implements Workable, Feedable, Manageable {
    @Override public void work() { /* ... */ }
    @Override public void eat() { /* ... */ }
    @Override public void sleep() { /* ... */ }
    @Override public void attendMeeting() { /* ... */ }
    @Override public void writeReport() { /* ... */ }
}

public class Robot implements Workable {
    @Override public void work() { /* ... */ }
    // No unnecessary methods!
}

public class Intern implements Workable, Feedable {
    @Override public void work() { /* ... */ }
    @Override public void eat() { /* ... */ }
    @Override public void sleep() { /* ... */ }
    // No meeting/report methods!
}
\`\`\`

### How to Detect ISP Violations

- Implementations with empty methods or \`throw new UnsupportedOperationException()\`
- Interface has 10+ methods
- Different clients use completely different subsets of methods
- Changes to interface affect unrelated implementations

### Java Standard Library Violations

\`\`\`java
// java.util.List has many methods - but this is acceptable for collections
// However, be careful with your own interfaces!

// ❌ This interface is too fat for most use cases
public interface Repository<T> {
    T findById(Long id);
    List<T> findAll();
    T save(T entity);
    void delete(T entity);
    void deleteById(Long id);
    List<T> findByExample(T example);
    Page<T> findAll(Pageable pageable);
    List<T> findAllById(Iterable<Long> ids);
    long count();
    boolean existsById(Long id);
    // ... 20 more methods
}

// ✅ Better: Split by use case
public interface ReadRepository<T> {
    Optional<T> findById(Long id);
    List<T> findAll();
}

public interface WriteRepository<T> {
    T save(T entity);
    void delete(T entity);
}
\`\`\`

---

## D - Dependency Inversion Principle (DIP)

> "High-level modules should not depend on low-level modules. Both should depend on abstractions."

### Violation

\`\`\`java
// ❌ BAD: High-level depends on low-level directly
public class OrderService {
    private MySqlOrderRepository repository;  // Concrete class!
    private SmtpEmailSender emailSender;      // Concrete class!

    public OrderService() {
        this.repository = new MySqlOrderRepository();  // Hard dependency
        this.emailSender = new SmtpEmailSender();      // Hard dependency
    }

    public void createOrder(Order order) {
        repository.save(order);
        emailSender.send(order.getCustomerEmail(), "Order confirmed");
    }
}
\`\`\`

**Problems:**
- Cannot test without real MySQL database
- Cannot swap email provider
- OrderService knows about MySQL, SMTP details

### Refactored

\`\`\`java
// ✅ GOOD: Depend on abstractions

// Abstractions (interfaces)
public interface OrderRepository {
    void save(Order order);
    Optional<Order> findById(Long id);
}

public interface NotificationSender {
    void send(String recipient, String message);
}

// High-level module depends on abstractions
public class OrderService {
    private final OrderRepository repository;
    private final NotificationSender notificationSender;

    // Dependencies injected
    public OrderService(OrderRepository repository,
                        NotificationSender notificationSender) {
        this.repository = repository;
        this.notificationSender = notificationSender;
    }

    public void createOrder(Order order) {
        repository.save(order);
        notificationSender.send(order.getCustomerEmail(), "Order confirmed");
    }
}

// Low-level modules implement abstractions
public class MySqlOrderRepository implements OrderRepository {
    @Override
    public void save(Order order) { /* MySQL specific */ }

    @Override
    public Optional<Order> findById(Long id) { /* MySQL specific */ }
}

public class SmtpEmailSender implements NotificationSender {
    @Override
    public void send(String recipient, String message) { /* SMTP specific */ }
}

// Easy to test with mocks!
public class InMemoryOrderRepository implements OrderRepository {
    private Map<Long, Order> orders = new HashMap<>();

    @Override
    public void save(Order order) {
        orders.put(order.getId(), order);
    }

    @Override
    public Optional<Order> findById(Long id) {
        return Optional.ofNullable(orders.get(id));
    }
}
\`\`\`

### DIP with Spring

\`\`\`java
// Spring handles dependency injection automatically

@Service
public class OrderService {
    private final OrderRepository repository;
    private final NotificationSender notificationSender;

    // Constructor injection (recommended)
    public OrderService(OrderRepository repository,
                        NotificationSender notificationSender) {
        this.repository = repository;
        this.notificationSender = notificationSender;
    }
}

@Repository
public class JpaOrderRepository implements OrderRepository {
    // Spring provides implementation
}

@Component
@Profile("production")
public class SmtpEmailSender implements NotificationSender { }

@Component
@Profile("test")
public class MockEmailSender implements NotificationSender { }
\`\`\`

### How to Detect DIP Violations

- \`new ConcreteClass()\` inside business logic
- Import statements include implementation packages (e.g., \`com.mysql\`, \`org.apache.http\`)
- Cannot easily swap implementations
- Tests require real infrastructure (database, network)

---

## SOLID Review Checklist

When reviewing code, check:

| Principle | Question |
|-----------|----------|
| **SRP** | Does this class have more than one reason to change? |
| **OCP** | Will adding a new type/feature require modifying this class? |
| **LSP** | Can subclasses be used wherever parent is expected? |
| **ISP** | Are there empty or throwing method implementations? |
| **DIP** | Does high-level code depend on concrete implementations? |

---

## Common Refactoring Patterns

| Violation | Refactoring |
|-----------|-------------|
| SRP - God class | Extract Class, Move Method |
| OCP - Type switching | Strategy Pattern, Factory |
| LSP - Broken inheritance | Composition over Inheritance, Extract Interface |
| ISP - Fat interface | Split Interface, Role Interface |
| DIP - Hard dependencies | Dependency Injection, Abstract Factory |

---

## Related Skills

- \`design-patterns\` - Implementation patterns (Factory, Strategy, Observer, etc.)
- \`clean-code\` - Code-level principles (DRY, KISS, naming)
- \`java-code-review\` - Comprehensive review checklist`,
  },
  {
    id: 'java-spring-boot-patterns',
    name: 'spring-boot-patterns',
    description: 'Spring Boot best practices: controllers, services, repositories, configuration, error handling.',
    category: 'java',
    trigger: '/java-spring',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# Spring Boot Patterns Skill

Best practices and patterns for Spring Boot applications.

## When to Use
- User says "create controller" / "add service" / "Spring Boot help"
- Reviewing Spring Boot code
- Setting up new Spring Boot project structure

## Project Structure

\`\`\`
src/main/java/com/example/myapp/
├── MyAppApplication.java          # @SpringBootApplication
├── config/                        # Configuration classes
│   ├── SecurityConfig.java
│   └── WebConfig.java
├── controller/                    # REST controllers
│   └── UserController.java
├── service/                       # Business logic
│   ├── UserService.java
│   └── impl/
│       └── UserServiceImpl.java
├── repository/                    # Data access
│   └── UserRepository.java
├── model/                         # Entities
│   └── User.java
├── dto/                           # Data transfer objects
│   ├── request/
│   │   └── CreateUserRequest.java
│   └── response/
│       └── UserResponse.java
├── exception/                     # Custom exceptions
│   ├── ResourceNotFoundException.java
│   └── GlobalExceptionHandler.java
└── util/                          # Utilities
    └── DateUtils.java
\`\`\`

---

## Controller Patterns

### REST Controller Template
\`\`\`java
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor  // Lombok for constructor injection
public class UserController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<List<UserResponse>> getAll() {
        return ResponseEntity.ok(userService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.findById(id));
    }

    @PostMapping
    public ResponseEntity<UserResponse> create(
            @Valid @RequestBody CreateUserRequest request) {
        UserResponse created = userService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}")
            .buildAndExpand(created.getId())
            .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        userService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
\`\`\`

### Controller Best Practices

| Practice | Example |
|----------|---------|
| Versioned API | \`/api/v1/users\` |
| Plural nouns | \`/users\` not \`/user\` |
| HTTP methods | GET=read, POST=create, PUT=update, DELETE=delete |
| Status codes | 200=OK, 201=Created, 204=NoContent, 404=NotFound |
| Validation | \`@Valid\` on request body |

### ❌ Anti-patterns
\`\`\`java
// ❌ Business logic in controller
@PostMapping
public User create(@RequestBody User user) {
    user.setCreatedAt(LocalDateTime.now());  // Logic belongs in service
    return userRepository.save(user);         // Direct repo access
}

// ❌ Returning entity directly (exposes internals)
@GetMapping("/{id}")
public User getById(@PathVariable Long id) {
    return userRepository.findById(id).get();
}
\`\`\`

---

## Service Patterns

### Service Interface + Implementation
\`\`\`java
// Interface
public interface UserService {
    List<UserResponse> findAll();
    UserResponse findById(Long id);
    UserResponse create(CreateUserRequest request);
    UserResponse update(Long id, UpdateUserRequest request);
    void delete(Long id);
}

// Implementation
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)  // Default read-only
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;

    @Override
    public List<UserResponse> findAll() {
        return userRepository.findAll().stream()
            .map(userMapper::toResponse)
            .toList();
    }

    @Override
    public UserResponse findById(Long id) {
        return userRepository.findById(id)
            .map(userMapper::toResponse)
            .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    @Override
    @Transactional  // Write transaction
    public UserResponse create(CreateUserRequest request) {
        User user = userMapper.toEntity(request);
        User saved = userRepository.save(user);
        return userMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        if (!userRepository.existsById(id)) {
            throw new ResourceNotFoundException("User", id);
        }
        userRepository.deleteById(id);
    }
}
\`\`\`

### Service Best Practices

- Interface + Impl for testability
- \`@Transactional(readOnly = true)\` at class level
- \`@Transactional\` for write methods
- Throw domain exceptions, not generic ones
- Use mappers (MapStruct) for entity ↔ DTO conversion

---

## Repository Patterns

### JPA Repository
\`\`\`java
public interface UserRepository extends JpaRepository<User, Long> {

    // Derived query
    Optional<User> findByEmail(String email);

    List<User> findByActiveTrue();

    // Custom query
    @Query("SELECT u FROM User u WHERE u.department.id = :deptId")
    List<User> findByDepartmentId(@Param("deptId") Long departmentId);

    // Native query (use sparingly)
    @Query(value = "SELECT * FROM users WHERE created_at > :date",
           nativeQuery = true)
    List<User> findRecentUsers(@Param("date") LocalDate date);

    // Exists check (more efficient than findBy)
    boolean existsByEmail(String email);

    // Count
    long countByActiveTrue();
}
\`\`\`

### Repository Best Practices

- Use derived queries when possible
- \`Optional\` for single results
- \`existsBy\` instead of \`findBy\` for existence checks
- Avoid native queries unless necessary
- Use \`@EntityGraph\` for fetch optimization

---

## DTO Patterns

### Request/Response DTOs
\`\`\`java
// Request DTO with validation
public record CreateUserRequest(
    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 100)
    String name,

    @NotBlank
    @Email(message = "Invalid email format")
    String email,

    @NotNull
    @Min(18)
    Integer age
) {}

// Response DTO
public record UserResponse(
    Long id,
    String name,
    String email,
    LocalDateTime createdAt
) {}
\`\`\`

### MapStruct Mapper
\`\`\`java
@Mapper(componentModel = "spring")
public interface UserMapper {

    UserResponse toResponse(User entity);

    List<UserResponse> toResponseList(List<User> entities);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    User toEntity(CreateUserRequest request);
}
\`\`\`

---

## Exception Handling

### Custom Exceptions
\`\`\`java
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String resource, Long id) {
        super(String.format("%s not found with id: %d", resource, id));
    }
}

public class BusinessException extends RuntimeException {

    private final String code;

    public BusinessException(String code, String message) {
        super(message);
        this.code = code;
    }
}
\`\`\`

### Global Exception Handler
\`\`\`java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        log.warn("Resource not found: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex) {
        List<String> errors = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .toList();
        return ResponseEntity.badRequest()
            .body(new ErrorResponse("VALIDATION_ERROR", errors.toString()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        log.error("Unexpected error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}

public record ErrorResponse(String code, String message) {}
\`\`\`

---

## Configuration Patterns

### Application Properties
\`\`\`yaml
# application.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: \${DB_USER}
    password: \${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate  # Never 'create' in production!
    show-sql: false

app:
  jwt:
    secret: \${JWT_SECRET}
    expiration: 86400000
\`\`\`

### Configuration Properties Class
\`\`\`java
@Configuration
@ConfigurationProperties(prefix = "app.jwt")
@Validated
public class JwtProperties {

    @NotBlank
    private String secret;

    @Min(60000)
    private long expiration;

    // getters and setters
}
\`\`\`

### Profile-Specific Configuration
\`\`\`
src/main/resources/
├── application.yml           # Common config
├── application-dev.yml       # Development
├── application-test.yml      # Testing
└── application-prod.yml      # Production
\`\`\`

---

## Common Annotations Quick Reference

| Annotation | Purpose |
|------------|---------|
| \`@RestController\` | REST controller (combines @Controller + @ResponseBody) |
| \`@Service\` | Business logic component |
| \`@Repository\` | Data access component |
| \`@Configuration\` | Configuration class |
| \`@RequiredArgsConstructor\` | Lombok: constructor injection |
| \`@Transactional\` | Transaction management |
| \`@Valid\` | Trigger validation |
| \`@ConfigurationProperties\` | Bind properties to class |
| \`@Profile("dev")\` | Profile-specific bean |
| \`@Scheduled\` | Scheduled tasks |

---

## Testing Patterns

### Controller Test (MockMvc)
\`\`\`java
@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Test
    void shouldReturnUser() throws Exception {
        when(userService.findById(1L))
            .thenReturn(new UserResponse(1L, "John", "john@example.com", null));

        mockMvc.perform(get("/api/v1/users/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("John"));
    }
}
\`\`\`

### Service Test
\`\`\`java
@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private UserServiceImpl userService;

    @Test
    void shouldThrowWhenUserNotFound() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.findById(1L))
            .isInstanceOf(ResourceNotFoundException.class);
    }
}
\`\`\`

### Integration Test
\`\`\`java
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class UserIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldCreateUser() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name": "John", "email": "john@example.com", "age": 25}
                    """))
            .andExpect(status().isCreated());
    }
}
\`\`\`

---

## Quick Reference Card

| Layer | Responsibility | Annotations |
|-------|---------------|-------------|
| Controller | HTTP handling, validation | \`@RestController\`, \`@Valid\` |
| Service | Business logic, transactions | \`@Service\`, \`@Transactional\` |
| Repository | Data access | \`@Repository\`, extends \`JpaRepository\` |
| DTO | Data transfer | Records with validation annotations |
| Config | Configuration | \`@Configuration\`, \`@ConfigurationProperties\` |
| Exception | Error handling | \`@RestControllerAdvice\` |`,
  },
  {
    id: 'java-test-quality',
    name: 'test-quality',
    description: 'Write high-quality JUnit 5 tests with AssertJ assertions. Test patterns, coverage, mocking.',
    category: 'java',
    trigger: '/java-test',
    source: 'community',
    author: 'decebals',
    promptTemplate: `$ARGUMENTS

# Test Quality Skill (JUnit 5 + AssertJ)

Write high-quality, maintainable tests for Java projects using modern best practices.

## When to Use
- Writing new test classes
- Reviewing/improving existing tests
- User asks to "add tests" / "improve test coverage"
- Code review mentions missing tests

## Framework Preferences

### JUnit 5 (Jupiter)
\`\`\`java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import static org.assertj.core.api.Assertions.*;
\`\`\`

### AssertJ over standard assertions
✅ **Use AssertJ**:
\`\`\`java
assertThat(plugin.getState())
    .as("Plugin should be started after initialization")
    .isEqualTo(PluginState.STARTED);

assertThat(plugins)
    .hasSize(3)
    .extracting(Plugin::getId)
    .containsExactly("plugin1", "plugin2", "plugin3");
\`\`\`

❌ **Avoid JUnit assertions**:
\`\`\`java
assertEquals(PluginState.STARTED, plugin.getState()); // Less readable
assertTrue(plugins.size() == 3); // Less descriptive failures
\`\`\`

## Test Structure (AAA Pattern)

Always use Arrange-Act-Assert pattern:

\`\`\`java
@Test
@DisplayName("Should load plugin from valid directory")
void shouldLoadPluginFromValidDirectory() {
    // Arrange - Setup test data and dependencies
    Path pluginDir = Paths.get("test-plugins/valid-plugin");
    PluginLoader loader = new DefaultPluginLoader();
    
    // Act - Execute the behavior being tested
    Plugin plugin = loader.load(pluginDir);
    
    // Assert - Verify results
    assertThat(plugin)
        .isNotNull()
        .extracting(Plugin::getId, Plugin::getVersion)
        .containsExactly("test-plugin", "1.0.0");
}
\`\`\`

## Naming Conventions

### Test class names
\`\`\`java
// Class under test: PluginManager
PluginManagerTest           // ✅ Simple, standard
PluginManagerShould         // ✅ BDD style (if team prefers)
TestPluginManager           // ❌ Avoid
\`\`\`

### Test method names

**Option 1: should_expectedBehavior_when_condition** (descriptive)
\`\`\`java
@Test
void should_throwException_when_pluginDirectoryNotFound() { }

@Test  
void should_returnEmptyList_when_noPluginsAvailable() { }

@Test
void should_loadPluginsInDependencyOrder_when_multipleDependencies() { }
\`\`\`

**Option 2: Natural language with @DisplayName** (cleaner code)
\`\`\`java
@Test
@DisplayName("Should load all plugins from directory")
void loadAllPlugins() { }

@Test
@DisplayName("Should throw exception when plugin descriptor is invalid")
void invalidPluginDescriptor() { }
\`\`\`

## AssertJ Power Features

### Collection assertions
\`\`\`java
// Basic collection checks
assertThat(plugins)
    .isNotEmpty()
    .hasSize(2)
    .doesNotContainNull();

// Advanced filtering and extraction
assertThat(plugins)
    .filteredOn(p -> p.getState() == PluginState.STARTED)
    .extracting(Plugin::getId)
    .containsExactlyInAnyOrder("plugin-a", "plugin-b");

// All elements match condition
assertThat(plugins)
    .allMatch(p -> p.getVersion() != null, "All plugins have version");
\`\`\`

### Exception assertions
\`\`\`java
// Basic exception check
assertThatThrownBy(() -> loader.load(invalidPath))
    .isInstanceOf(PluginException.class)
    .hasMessageContaining("Invalid plugin descriptor");

// Detailed exception verification
assertThatThrownBy(() -> manager.startPlugin("missing-plugin"))
    .isInstanceOf(PluginException.class)
    .hasMessageContaining("Plugin not found")
    .hasCauseInstanceOf(IllegalArgumentException.class)
    .hasNoCause(); // or verify cause chain

// With assertThatExceptionOfType (more readable)
assertThatExceptionOfType(PluginException.class)
    .isThrownBy(() -> loader.load(invalidPath))
    .withMessageContaining("Invalid")
    .withMessageMatching("Invalid .* descriptor");
\`\`\`

### Object assertions
\`\`\`java
// Extract and verify multiple properties
assertThat(plugin)
    .isNotNull()
    .extracting("id", "version", "state")
    .containsExactly("my-plugin", "1.0", PluginState.STARTED);

// Using method references (type-safe)
assertThat(plugin)
    .extracting(Plugin::getId, Plugin::getVersion, Plugin::getState)
    .containsExactly("my-plugin", "1.0", PluginState.STARTED);

// Field by field comparison
assertThat(actualPlugin)
    .usingRecursiveComparison()
    .isEqualTo(expectedPlugin);
\`\`\`

### Soft assertions (multiple checks)
\`\`\`java
@Test
void shouldHaveValidPluginDescriptor() {
    SoftAssertions softly = new SoftAssertions();
    
    softly.assertThat(descriptor.getId())
        .as("Plugin ID")
        .isNotBlank()
        .matches("[a-z0-9-]+");
    
    softly.assertThat(descriptor.getVersion())
        .as("Plugin version")
        .matches("\\\\d+\\\\.\\\\d+\\\\.\\\\d+");
    
    softly.assertThat(descriptor.getDependencies())
        .as("Dependencies")
        .isNotNull()
        .doesNotContainNull();
    
    softly.assertAll(); // All assertions evaluated, even if some fail
}
\`\`\`

### String assertions
\`\`\`java
assertThat(errorMessage)
    .startsWith("Error:")
    .contains("plugin", "failed")
    .doesNotContain("success")
    .matches("Error: .* failed")
    .hasLineCount(3);
\`\`\`

## Test Organization

### Nested tests for clarity
\`\`\`java
@DisplayName("PluginManager")
class PluginManagerTest {
    
    private PluginManager manager;
    
    @BeforeEach
    void setUp() {
        manager = new DefaultPluginManager();
    }
    
    @Nested
    @DisplayName("when starting plugins")
    class WhenStartingPlugins {
        
        @Test
        @DisplayName("should start all plugins in dependency order")
        void shouldStartInDependencyOrder() {
            // Test implementation
        }
        
        @Test
        @DisplayName("should skip disabled plugins")
        void shouldSkipDisabledPlugins() {
            // Test implementation
        }
        
        @Test
        @DisplayName("should fail if circular dependency detected")
        void shouldFailOnCircularDependency() {
            // Test implementation
        }
    }
    
    @Nested
    @DisplayName("when stopping plugins")  
    class WhenStoppingPlugins {
        
        @Test
        @DisplayName("should stop plugins in reverse dependency order")
        void shouldStopInReverseOrder() {
            // Test implementation
        }
    }
}
\`\`\`

### Parameterized tests
\`\`\`java
@ParameterizedTest
@ValueSource(strings = {"1.0.0", "2.1.3", "10.0.0-SNAPSHOT"})
@DisplayName("Should accept valid semantic versions")
void shouldAcceptValidVersions(String version) {
    assertThat(VersionParser.parse(version))
        .isNotNull()
        .hasFieldOrPropertyWithValue("valid", true);
}

@ParameterizedTest
@CsvSource({
    "plugin-a, 1.0, STARTED",
    "plugin-b, 2.0, STOPPED",
    "plugin-c, 1.5, DISABLED"
})
@DisplayName("Should load plugin with expected state")
void shouldLoadPluginWithState(String id, String version, PluginState expectedState) {
    Plugin plugin = createPlugin(id, version);
    
    assertThat(plugin.getState()).isEqualTo(expectedState);
}

@ParameterizedTest
@MethodSource("invalidPluginDescriptors")
@DisplayName("Should reject invalid plugin descriptors")
void shouldRejectInvalidDescriptors(PluginDescriptor descriptor, String expectedError) {
    assertThatThrownBy(() -> validator.validate(descriptor))
        .hasMessageContaining(expectedError);
}

static Stream<Arguments> invalidPluginDescriptors() {
    return Stream.of(
        Arguments.of(descriptorWithoutId(), "Missing plugin ID"),
        Arguments.of(descriptorWithInvalidVersion(), "Invalid version format"),
        Arguments.of(descriptorWithEmptyId(), "Plugin ID cannot be empty")
    );
}
\`\`\`

## Common Patterns

### Testing with mocks (Mockito)
\`\`\`java
@ExtendWith(MockitoExtension.class)
class PluginManagerTest {
    
    @Mock
    private PluginRepository repository;
    
    @Mock
    private PluginValidator validator;
    
    @InjectMocks
    private DefaultPluginManager manager;
    
    @Test
    @DisplayName("Should load plugins from repository")
    void shouldLoadPluginsFromRepository() {
        // Given
        List<PluginDescriptor> descriptors = List.of(
            createDescriptor("plugin1"),
            createDescriptor("plugin2")
        );
        when(repository.findAll()).thenReturn(descriptors);
        
        // When
        List<Plugin> plugins = manager.loadAll();
        
        // Then
        assertThat(plugins).hasSize(2);
        verify(repository).findAll();
        verify(validator, times(2)).validate(any(PluginDescriptor.class));
    }
}
\`\`\`

### Test fixtures with @BeforeEach
\`\`\`java
@BeforeEach
void setUp() throws IOException {
    // Create temporary directory for test plugins
    pluginDir = Files.createTempDirectory("test-plugins");
    
    // Initialize plugin manager with test config
    PluginConfig config = PluginConfig.builder()
        .pluginDirectory(pluginDir)
        .enableValidation(true)
        .build();
    
    pluginManager = new DefaultPluginManager(config);
}

@AfterEach
void tearDown() throws IOException {
    // Clean up test resources
    if (pluginManager != null) {
        pluginManager.stopAll();
    }
    if (pluginDir != null) {
        FileUtils.deleteDirectory(pluginDir.toFile());
    }
}
\`\`\`

### Testing async operations
\`\`\`java
@Test
@DisplayName("Should complete async plugin loading")
void shouldCompleteAsyncLoading() {
    CompletableFuture<Plugin> future = manager.loadAsync(pluginPath);
    
    assertThat(future)
        .succeedsWithin(Duration.ofSeconds(5))
        .satisfies(plugin -> {
            assertThat(plugin.getState()).isEqualTo(PluginState.STARTED);
            assertThat(plugin.getId()).isNotBlank();
        });
}
\`\`\`

## Token Optimization

When writing tests:

### 1. Generate test skeleton first
\`\`\`java
// Phase 1: List test cases as comments
// @Test void shouldLoadPlugin() { }
// @Test void shouldThrowExceptionForInvalidPlugin() { }
// @Test void shouldHandleMissingDependencies() { }
\`\`\`

### 2. Implement incrementally
- One test at a time
- Verify compilation after each
- Run tests to validate
- Refactor if needed

### 3. Reuse patterns
\`\`\`java
// Extract common setup to helper methods
private Plugin createTestPlugin(String id, String version) {
    return Plugin.builder()
        .id(id)
        .version(version)
        .build();
}
\`\`\`

## Code Coverage Guidelines

- **Aim for**: 80%+ line coverage on core logic
- **Focus on**: Business logic, complex algorithms, edge cases
- **Skip**: Trivial getters/setters, POJOs, generated code
- **Test**: Happy paths + error conditions + boundary cases

### What to test
✅ **High priority**:
- Public APIs
- Complex business logic
- Error handling
- Edge cases and boundaries
- Integration points

❌ **Low priority**:
\`\`\`java
// Simple getters/setters
public String getId() { return id; }
public void setId(String id) { this.id = id; }

// Simple POJOs with no logic
public class PluginInfo {
    private String id;
    private String version;
    // ... only getters/setters
}
\`\`\`

## Anti-patterns

❌ **Avoid**:
\`\`\`java
// 1. Generic test names
@Test void test1() { }
@Test void testPlugin() { }

// 2. Testing implementation details
assertThat(plugin.internalState.flag).isTrue(); // Couples to internals

// 3. Brittle assertions with timestamps
assertThat(message).isEqualTo("Error at 2024-01-26 10:30:15");

// 4. Multiple unrelated assertions
@Test void testEverything() {
    // 50 unrelated assertions
    assertThat(plugin.getId()).isNotNull();
    assertThat(manager.getCount()).isEqualTo(5);
    assertThat(config.isEnabled()).isTrue();
    // ... mixing multiple concerns
}

// 5. Ignoring exceptions
@Test void shouldFail() {
    try {
        loader.load(invalidPath);
        fail("Should have thrown exception");
    } catch (Exception e) {
        // Swallowing exception details
    }
}
\`\`\`

✅ **Prefer**:
\`\`\`java
@Test
@DisplayName("Should reject plugin with missing dependencies")
void shouldRejectPluginWithMissingDependencies() {
    PluginDescriptor descriptor = PluginDescriptor.builder()
        .id("test-plugin")
        .dependencies(List.of("missing-dep"))
        .build();
    
    assertThatThrownBy(() -> manager.load(descriptor))
        .isInstanceOf(PluginException.class)
        .hasMessageContaining("Missing dependencies: missing-dep");
}
\`\`\`

## Integration with Coverage Tools

### Maven configuration
\`\`\`xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.11</version>
    <executions>
        <execution>
            <goals>
                <goal>prepare-agent</goal>
            </goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>test</phase>
            <goals>
                <goal>report</goal>
            </goals>
        </execution>
    </executions>
</plugin>
\`\`\`

### After test generation, suggest:
\`\`\`bash
# Run tests with coverage
mvn clean test jacoco:report

# View coverage report
open target/site/jacoco/index.html

# Check coverage threshold
mvn verify # Fails if below configured threshold
\`\`\`

## Quick Reference

\`\`\`java
// ===== Basic Assertions =====
assertThat(value).isEqualTo(expected);
assertThat(value).isNotNull();
assertThat(value).isInstanceOf(String.class);
assertThat(number).isPositive().isGreaterThan(5);

// ===== Collections =====
assertThat(list).hasSize(3);
assertThat(list).contains(item);
assertThat(list).containsExactly(item1, item2, item3);
assertThat(list).containsExactlyInAnyOrder(item2, item1, item3);
assertThat(list).doesNotContain(item);
assertThat(list).allMatch(predicate);

// ===== Strings =====
assertThat(str).isNotBlank();
assertThat(str).startsWith("prefix");
assertThat(str).endsWith("suffix");
assertThat(str).contains("substring");
assertThat(str).matches("regex\\\\d+");

// ===== Exceptions =====
assertThatThrownBy(() -> code())
    .isInstanceOf(PluginException.class)
    .hasMessageContaining("error");

assertThatNoException().isThrownBy(() -> code());

// ===== Custom Descriptions =====
assertThat(userId)
    .as("User ID should be positive")
    .isPositive();

// ===== Object Comparison =====
assertThat(actual)
    .usingRecursiveComparison()
    .ignoringFields("timestamp", "id")
    .isEqualTo(expected);
\`\`\`

## Best Practices Summary

1. **Use AssertJ** for all assertions
2. **Follow AAA pattern** (Arrange-Act-Assert)
3. **Descriptive names** with @DisplayName
4. **One concept** per test
5. **Test behavior**, not implementation
6. **Extract helpers** for common setup
7. **Use @Nested** for logical grouping
8. **Parameterize** similar tests
9. **Soft assertions** for multiple checks
10. **Coverage** on business logic, not boilerplate

## References

- [AssertJ Documentation](https://assertj.github.io/doc/)
- [JUnit 5 User Guide](https://junit.org/junit5/docs/current/user-guide/)`,
  }
]
