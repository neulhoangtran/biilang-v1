import { EventEmitter } from 'eventemitter3';

export const appEvents = new EventEmitter();

export const APP_EVENTS = {
  WISHLIST_UPDATED: 'wishlist_updated',
};