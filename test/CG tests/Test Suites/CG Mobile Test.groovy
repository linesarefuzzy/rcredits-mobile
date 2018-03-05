import static com.kms.katalon.core.checkpoint.CheckpointFactory.findCheckpoint
import static com.kms.katalon.core.testcase.TestCaseFactory.findTestCase
import static com.kms.katalon.core.testdata.TestDataFactory.findTestData
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import com.kms.katalon.core.checkpoint.Checkpoint as Checkpoint
import com.kms.katalon.core.checkpoint.CheckpointFactory as CheckpointFactory
import com.kms.katalon.core.mobile.keyword.MobileBuiltInKeywords as MobileBuiltInKeywords
import com.kms.katalon.core.model.FailureHandling as FailureHandling
import com.kms.katalon.core.testcase.TestCase as TestCase
import com.kms.katalon.core.testcase.TestCaseFactory as TestCaseFactory
import com.kms.katalon.core.testdata.TestData as TestData
import com.kms.katalon.core.testdata.TestDataFactory as TestDataFactory
import com.kms.katalon.core.testobject.ObjectRepository as ObjectRepository
import com.kms.katalon.core.testobject.TestObject as TestObject
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WSBuiltInKeywords
import com.kms.katalon.core.webui.driver.DriverFactory as DriverFactory
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUiBuiltInKeywords
import internal.GlobalVariable as GlobalVariable
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.mobile.keyword.MobileBuiltInKeywords as Mobile
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS

import com.thoughtworks.selenium.Selenium
import org.openqa.selenium.firefox.FirefoxDriver
import org.openqa.selenium.remote.DesiredCapabilities
import org.openqa.selenium.WebDriver
import com.thoughtworks.selenium.webdriven.WebDriverBackedSelenium
import static org.junit.Assert.*
import java.util.regex.Pattern
import static org.apache.commons.lang3.StringUtils.join
ChromeOptions options = new ChromeOptions()
 options.addExtensions(new File("E:\\xampp\\htdocs\\cgf\\rcredits-mobile\\Access-Control-Allow-Origin\\extension.crx"))
 options.setBinary(new File("/path/to/chrome"));

 // For use with ChromeDriver:
 ChromeDriver driver = new ChromeDriver(options);
WebUI.openBrowser('http://127.0.0.1:8100')
//def driver = DriverFactory.getWebDriver()
String baseUrl = "http://127.0.0.1:8100"
selenium = new WebDriverBackedSelenium(driver, baseUrl)
selenium.open("http://127.0.0.1:8100/#/app/login")
selenium.click("id=scan")
selenium.click("xpath=(//img[@title='Demo User'])[2]")
selenium.click("//div[@id='wifi']/label")
selenium.click("id=scan")
selenium.click("//img[@title='Demo User']")
selenium.click("//ion-view[@id='customerPage']/ion-content/div/div/div/button[2]")
selenium.click("//ion-view/button")
selenium.click("//ion-view/button")
selenium.click("//table[@id='keypad']/tbody/tr/td")
selenium.click("//table[@id='keypad']/tbody/tr[3]/td[3]")
selenium.click("//table[@id='keypad']/tbody/tr[3]/td[3]")
selenium.doubleClick("//table[@id='keypad']/tbody/tr[3]/td[3]")
selenium.click("//table[@id='keypad']/tbody/tr[3]/td[3]")
selenium.click("//table[@id='keypad']/tbody/tr[3]/td[3]")
selenium.doubleClick("//table[@id='keypad']/tbody/tr[3]/td[3]")
selenium.click("//ion-view/button")
selenium.click("//div[3]/button")
selenium.open("http://127.0.0.1:8100/#/app/home")
selenium.click("//div[2]/ion-header-bar/div/span/button")
selenium.click("//ion-side-menu/ion-content/div/ion-list/div/ion-item[5]")
selenium.click("//ion-item[6]/div")
selenium.click("//button[2]")
