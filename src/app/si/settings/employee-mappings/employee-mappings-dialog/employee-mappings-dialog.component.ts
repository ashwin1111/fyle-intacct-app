import { Component, OnInit, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, FormGroupDirective, NgForm, ValidatorFn, AbstractControl } from '@angular/forms';
import { Observable } from 'rxjs/internal/Observable';
import { debounceTime } from 'rxjs/internal/operators/debounceTime';
import { distinctUntilChanged } from 'rxjs/internal/operators/distinctUntilChanged';
import { filter } from 'rxjs/internal/operators/filter';
import { map } from 'rxjs/internal/operators/map';
import { ActivatedRoute } from '@angular/router';
import { MappingsService } from 'src/app/core/services/mappings.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { forkJoin, from } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SettingsService } from 'src/app/core/services/settings.service';
import { ErrorStateMatcher } from '@angular/material/core';

export class MappingErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || control.touched || isSubmitted));
  }
}
@Component({
  selector: 'app-employee-mappings-dialog',
  templateUrl: './employee-mappings-dialog.component.html',
  styleUrls: ['./employee-mappings-dialog.component.scss', '../../settings.component.scss']
})
export class EmployeeMappingsDialogComponent implements OnInit {
  isLoading = false;
  form: FormGroup;
  workSpaceId: number;
  // TODO: replace any with relevant models
  fyleEmployees: any[];
  sageIntacctEmployees: any[];
  cccObjects: any[];
  sageIntacctVendors: any[];
  generalSettings: any;
  employeeOptions: any[];
  sageIntacctEmployeeOptions: any[];
  cccOptions: any[];
  sageIntacctVendorOptions: any[];

  matcher = new MappingErrorStateMatcher();

  constructor(private formBuilder: FormBuilder,
              public dialogRef: MatDialogRef<EmployeeMappingsDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: any,
              private mappingsService: MappingsService,
              private snackBar: MatSnackBar,
              private settingsService: SettingsService) { }


  mappingDisplay(mappingObject) {
    return mappingObject ? mappingObject.value : '';
  }

  submit() {
    const that = this;
    const fyleEmployee = that.form.value.fyleEmployee;
    const sageIntacctVendor = that.generalSettings.employee_field_mapping === 'VENDOR' ? that.form.value.sageIntacctVendor : '';
    const sageIntacctEmployee = that.generalSettings.employee_field_mapping === 'EMPLOYEE' ? that.form.value.sageIntacctEmployee : '';

    if (that.form.valid && (sageIntacctVendor || sageIntacctEmployee)) {
      const employeeMapping = [
        that.mappingsService.postMappings({
          source_type: 'EMPLOYEE',
          destination_type: that.generalSettings.employee_field_mapping,
          source_value: fyleEmployee.value,
          destination_value: that.generalSettings.employee_field_mapping === 'VENDOR' ? sageIntacctVendor.value : sageIntacctEmployee.value
        })
      ];

      that.isLoading = true;
      forkJoin(employeeMapping).subscribe(responses => {
        that.snackBar.open('Mapping saved successfully');
        that.isLoading = false;
        that.dialogRef.close();
      }, err => {
        that.snackBar.open('Something went wrong');
        that.isLoading = false;
      });

    } else {
      that.snackBar.open('Form has invalid fields');
      that.form.markAllAsTouched();
    }
  }

  forbiddenSelectionValidator(options: any[]): ValidatorFn {
    return (control: AbstractControl): {[key: string]: any} | null => {
      const forbidden = !options.some((option) => {
        return control.value.id && option.id === control.value.id;
      });
      return forbidden ? {
        forbiddenOption: {
          value: control.value
        }
      } : null;
    };
  }

  setupFyleEmployeeAutocompleteWatcher() {
    const that = this;
    that.form.controls.fyleEmployee.valueChanges.pipe(debounceTime(300)).subscribe((newValue) => {
      if (typeof (newValue) === 'string') {
        that.employeeOptions = that.fyleEmployees
          .filter(fyleEmployee => new RegExp(newValue.toLowerCase(), 'g').test(fyleEmployee.value.toLowerCase()));
      }
    });
  }

  setupSageIntacctVendorAutocompleteWatcher() {
    const that = this;

    that.form.controls.sageIntacctVendor.valueChanges.pipe(debounceTime(300)).subscribe((newValue) => {
      if (typeof (newValue) === 'string') {
        that.sageIntacctVendorOptions = that.sageIntacctVendors
          .filter(sageIntacctVendor => new RegExp(newValue.toLowerCase(), 'g').test(sageIntacctVendor.value.toLowerCase()));
      }
    });
  }

  setupSageIntacctEmployeesWatcher() {
    const that = this;

    that.form.controls.sageIntacctEmployee.valueChanges.pipe(debounceTime(300)).subscribe((newValue) => {
      if (typeof (newValue) === 'string') {
        that.sageIntacctEmployeeOptions = that.sageIntacctEmployees
          .filter(sageIntacctEmployee => new RegExp(newValue.toLowerCase(), 'g').test(sageIntacctEmployee.value.toLowerCase()));
      }
    });
  }

  setupAutocompleteWatchers() {
    const that = this;
    that.setupFyleEmployeeAutocompleteWatcher();
    that.setupSageIntacctVendorAutocompleteWatcher();
    that.setupSageIntacctEmployeesWatcher();
  }

  reset() {
    const that = this;
    // TODO: remove promises and do with rxjs observables
    const getFyleEmployees = that.mappingsService.getFyleEmployees().toPromise().then((fyleEmployees) => {
      that.fyleEmployees = fyleEmployees;
    });
    let getSageIntacctEquivalent;
    if (that.generalSettings.employee_field_mapping === 'EMPLOYEE') {
      // TODO: remove promises and do with rxjs observables
      getSageIntacctEquivalent = that.mappingsService.getSageIntacctEmployees().toPromise().then((sageIntacctEmployees) => {
        that.sageIntacctEmployees = sageIntacctEmployees;
      });
    } else if (that.generalSettings.employee_field_mapping === 'VENDOR') {
      // TODO: remove promises and do with rxjs observables
      getSageIntacctEquivalent = that.mappingsService.getSageIntacctVendors().toPromise().then((sageIntacctVendors) => {
        that.sageIntacctVendors = sageIntacctVendors;
      });
    }

    that.isLoading = true;
    forkJoin([
      from(getFyleEmployees),
      from(getSageIntacctEquivalent)
    ]).subscribe((res) => {
      that.isLoading = false;
      that.form = that.formBuilder.group({
        fyleEmployee: ['', Validators.compose([Validators.required, that.forbiddenSelectionValidator(that.fyleEmployees)])],
        sageIntacctVendor: ['', that.generalSettings.employee_field_mapping === 'VENDOR' ? that.forbiddenSelectionValidator(that.sageIntacctVendors) : null],
        sageIntacctEmployee: ['', that.generalSettings.employee_field_mapping === 'EMPLOYEE' ? that.forbiddenSelectionValidator(that.sageIntacctEmployees) : null]
      });
      that.setupAutocompleteWatchers();
    });
  }

  ngOnInit() {
    const that = this;
    that.workSpaceId = that.data.workspaceId;
    that.isLoading = true;
    that.settingsService.getCombinedSettings(that.workSpaceId).subscribe(settings => {
      that.generalSettings = settings;
      that.isLoading = false;
      that.reset();
    });
  }

}
