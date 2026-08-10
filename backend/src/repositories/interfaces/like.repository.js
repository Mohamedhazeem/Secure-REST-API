/**
 * Repository interface for Like entities (US4, FR-037).
 *
 * Implementations must provide all methods defined here.
 * The interface is framework-agnostic; implementations may use
 * Mongoose, an in-memory store, or any other persistence mechanism.
 */
export { default } from "../implementations/mongoose/like.repository.js";
