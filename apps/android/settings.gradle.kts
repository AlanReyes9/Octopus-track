pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "octopus-track-android"
// :core es la librería compartida (datos, tema, componentes). Dos apps separadas la usan:
// :client (comparte la ubicación de este teléfono, visible y con consentimiento) y
// :manager (panel: mapa en vivo, historial, geocercas, comandos, cuentas).
include(":core", ":client", ":manager")
