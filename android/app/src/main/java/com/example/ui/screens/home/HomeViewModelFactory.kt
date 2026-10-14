package com.example.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.example.data.discovery.ServerDiscoveryRepository
import com.example.data.storage.PreferencesManager

class HomeViewModelFactory(
    private val preferencesManager: PreferencesManager,
    private val discoveryRepo: ServerDiscoveryRepository
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(HomeViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return HomeViewModel(preferencesManager, discoveryRepo) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
