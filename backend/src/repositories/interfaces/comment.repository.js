/**
 * Repository interface for Comment entities (US5, FR-024).
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export { default } from "../implementations/mongoose/comment.repository.js";
