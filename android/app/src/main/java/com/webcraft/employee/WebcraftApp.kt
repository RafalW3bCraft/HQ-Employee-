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

class AppContainer {
    val leadRepository: LeadRepository by lazy { FakeLeadRepository() }
    val meetingRepository: MeetingRepository by lazy { FakeMeetingRepository() }
    val employeeRepository: EmployeeRepository by lazy { FakeEmployeeRepository() }
    val companyBrainRepository: CompanyBrainRepository by lazy { FakeCompanyBrainRepository() }
    val voiceCallRepository: VoiceCallRepository by lazy { FakeVoiceCallRepository() }
    val billingRepository: BillingRepository by lazy { FakeBillingRepository() }

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
