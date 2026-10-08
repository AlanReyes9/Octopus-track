package com.octopustrack.app.tracker

/** Implementado por la Application de la app que use [TrackingService] (hoy, solo la app Cliente). */
interface TrackerHost {
    val tracker: TrackerRepository
}
