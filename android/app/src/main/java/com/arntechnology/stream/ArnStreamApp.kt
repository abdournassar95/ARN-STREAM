package com.arntechnology.stream

import android.app.Application
import android.content.Context

class ArnStreamApp : Application() {

    companion object {
        lateinit var instance: ArnStreamApp
            private set

        fun getAppContext(): Context = instance.applicationContext
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }
}
