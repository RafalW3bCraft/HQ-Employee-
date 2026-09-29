package com.webcraft.employee

import android.app.Application
import com.webcraft.employee.data.fake.FakeCompanyBrainRepository
import com.webcraft.employee.data.fake.FakeEmployeeRepository
import com.webcraft.employee.data.fake.FakeLeadRepository
import com.webcraft.employee.data.fake.FakeMeetingRepository
import com.webcraft.employee.domain.repository.CompanyBrainRepository
import com.webcraft.employee.domain.repository.EmployeeRepository
import com.webcraft.employee.domain.repository.LeadRepository
import com.webcraft.employee.domain.repository.MeetingRepository
import com.webcraft.employee.domain.usecase.GetCompanyBrainUseCase
import com.webcraft.employee.domain.usecase.GetDashboardDataUseCase
import com.webcraft.employee.domain.usecase.GetEmployeeUseCase
import com.webcraft.employee.domain.usecase.GetLeadDetailUseCase
import com.webcraft.employee.domain.usecase.GetLeadsUseCase
import com.webcraft.employee.domain.usecase.GetMeetingsUseCase
import com.webcraft.employee.domain.usecase.ManagePolicyUseCase
import com.webcraft.employee.domain.usecase.UpdateCompanyProfileUseCase
import com.webcraft.employee.domain.usecase.UpsertFaqUseCase
import com.webcraft.employee.domain.usecase.UpsertServiceUseCase
import com.webcraft.employee.data.fake.FakeBillingRepository
import com.webcraft.employee.domain.repository.BillingRepository

import com.webcraft.employee.data.fake.FakeVoiceCallRepository
import com.webcraft.employee.domain.repository.VoiceCallRepository
import com.webcraft.employee.data.network.NetworkBillingRepository
import com.webcraft.employee.data.network.NetworkCompanyBrainRepository
import com.webcraft.employee.data.network.NetworkEmployeeRepository
import com.webcraft.employee.data.network.NetworkLeadRepository
import com.webcraft.employee.data.network.NetworkMeetingRepository
import com.webcraft.employee.data.network.NetworkVoiceCallRepository

class AppContainer(
    private val isProduction: Boolean = true,
    private val apiBaseUrl: String = "https://hq-employee.web.app"
) {
    val leadRepository: LeadRepository by lazy {
        if (isProduction) NetworkLeadRepository(apiBaseUrl) else FakeLeadRepository()
    }
    val meetingRepository: MeetingRepository by lazy {
        if (isProduction) NetworkMeetingRepository(apiBaseUrl) else FakeMeetingRepository()
    }
    val employeeRepository: EmployeeRepository by lazy {
        if (isProduction) NetworkEmployeeRepository(apiBaseUrl) else FakeEmployeeRepository()
    }
    val companyBrainRepository: CompanyBrainRepository by lazy {
        if (isProduction) NetworkCompanyBrainRepository(apiBaseUrl) else FakeCompanyBrainRepository()
    }
    val voiceCallRepository: VoiceCallRepository by lazy {
        if (isProduction) NetworkVoiceCallRepository(apiBaseUrl) else FakeVoiceCallRepository()
    }
    val billingRepository: BillingRepository by lazy {
        if (isProduction) NetworkBillingRepository(apiBaseUrl) else FakeBillingRepository()
    }

    val getDashboardDataUseCase by lazy {
        GetDashboardDataUseCase(leadRepository, meetingRepository)
    }
    val getLeadsUseCase by lazy {
        GetLeadsUseCase(leadRepository)
    }
    val getLeadDetailUseCase by lazy {
        GetLeadDetailUseCase(leadRepository)
    }
    val getMeetingsUseCase by lazy {
        GetMeetingsUseCase(meetingRepository)
    }
    val getEmployeeUseCase by lazy {
        GetEmployeeUseCase(employeeRepository)
    }
    val getCompanyBrainUseCase by lazy {
        GetCompanyBrainUseCase(companyBrainRepository)
    }
    val updateCompanyProfileUseCase by lazy {
        UpdateCompanyProfileUseCase(companyBrainRepository)
    }
    val upsertServiceUseCase by lazy {
        UpsertServiceUseCase(companyBrainRepository)
    }
    val upsertFaqUseCase by lazy {
        UpsertFaqUseCase(companyBrainRepository)
    }
    val managePolicyUseCase by lazy {
        ManagePolicyUseCase(companyBrainRepository)
    }
}

class WebcraftApp : Application() {
    lateinit var container: AppContainer

    override fun onCreate() {
        super.onCreate()
        container = AppContainer()
    }
}
